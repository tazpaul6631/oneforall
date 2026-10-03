import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { DataSource, In, Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { OrderLine } from '../../core/order/order.entity';
import { OrderService } from '../../core/order/order.service';
import { ProductService } from '../../core/product/product.service';
import { CheckoutDto, MovieDto, RoomDto, ShowtimeDto } from './cinema.dto';
import { CinemaMovie, CinemaRoom, CinemaSale, CinemaSeat, CinemaShowtime, CinemaTicket, SeatKind } from './cinema.entity';

const HOLD_MS = 10 * 60 * 1000;
const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class CinemaService {
  private movies: TenantRepository<CinemaMovie>;
  private rooms: TenantRepository<CinemaRoom>;
  private seats: TenantRepository<CinemaSeat>;
  private shows: TenantRepository<CinemaShowtime>;
  private tickets: TenantRepository<CinemaTicket>;
  private sales: TenantRepository<CinemaSale>;

  constructor(
    @InjectRepository(CinemaMovie) movieRepo: Repository<CinemaMovie>,
    @InjectRepository(CinemaRoom) roomRepo: Repository<CinemaRoom>,
    @InjectRepository(CinemaSeat) private readonly seatRepo: Repository<CinemaSeat>,
    @InjectRepository(CinemaShowtime) showRepo: Repository<CinemaShowtime>,
    @InjectRepository(CinemaTicket) private readonly ticketRepo: Repository<CinemaTicket>,
    @InjectRepository(CinemaSale) saleRepo: Repository<CinemaSale>,
    @InjectRepository(OrderLine) private readonly lineRepo: Repository<OrderLine>,
    private readonly cls: ClsService,
    private readonly ds: DataSource,
    private readonly orders: OrderService,
    private readonly products: ProductService,
  ) {
    this.movies = new TenantRepository(movieRepo, cls);
    this.rooms = new TenantRepository(roomRepo, cls);
    this.seats = new TenantRepository(seatRepo, cls);
    this.shows = new TenantRepository(showRepo, cls);
    this.tickets = new TenantRepository(ticketRepo, cls);
    this.sales = new TenantRepository(saleRepo, cls);
  }

  private get tenantId() {
    return this.cls.get('tenantId') as string;
  }

  private label(seat: CinemaSeat) {
    return `${seat.rowLabel}${seat.number}`;
  }

  private taken(ticket: CinemaTicket | undefined, now: Date, holdKey?: string) {
    if (!ticket || ticket.status === 'refunded') return false;
    if (ticket.status === 'sold') return true;
    if (holdKey && ticket.holdKey === holdKey) return false;
    return !!ticket.holdUntil && new Date(ticket.holdUntil).getTime() > now.getTime();
  }

  async catalog() {
    const [movies, rooms, showtimes] = await Promise.all([
      this.movies.find({}, { order: { title: 'ASC' } }),
      this.rooms.find({}, { order: { name: 'ASC' } }),
      this.shows.find({}, { order: { startsAt: 'ASC' } }),
    ]);
    const seatRows = await this.seats.find({});
    const tickets = await this.tickets.find({ status: 'sold' });
    const movieById = new Map(movies.map((m) => [m.id, m]));
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    return {
      movies: await Promise.all(movies.map(async (m) => {
        const product = await this.products.get(m.productId);
        const vip = product.variants.find((v) => v.id === m.vipVariantId);
        return { ...m, priceVnd: product.priceVnd, vipPriceVnd: vip?.priceVnd ?? null };
      })),
      rooms: rooms.map((r) => ({
        ...r,
        seats: seatRows.filter((s) => s.roomId === r.id).length,
      })),
      showtimes: showtimes.map((s) => ({
        ...s,
        movieTitle: movieById.get(s.movieId)?.title ?? '',
        roomName: roomById.get(s.roomId)?.name ?? '',
        durationMin: movieById.get(s.movieId)?.durationMin ?? 0,
        sold: tickets.filter((t) => t.showtimeId === s.id).length,
        seats: seatRows.filter((seat) => seat.roomId === s.roomId).length,
      })),
    };
  }

  async createMovie(dto: MovieDto) {
    const cats = await this.products.listCategories();
    const cat = cats.find((c) => c.name === 'Phim') ?? await this.products.createCategory({ name: 'Phim' });
    const product = await this.products.create({
      name: dto.title.trim(),
      priceVnd: dto.priceVnd,
      categoryId: cat.id,
      variants: dto.vipPriceVnd != null ? [{ name: 'VIP', priceVnd: dto.vipPriceVnd }] : undefined,
    });
    const vip = product.variants.find((v) => v.name === 'VIP');
    const movie = await this.movies.save({
      productId: product.id,
      vipVariantId: vip?.id ?? null,
      title: dto.title.trim(),
      durationMin: dto.durationMin,
    });
    return { ...movie, priceVnd: product.priceVnd, vipPriceVnd: vip?.priceVnd ?? null };
  }

  async dropForProduct(productId: string) {
    const movie = await this.movies.findOne({ productId });
    if (!movie) return;
    const shows = await this.shows.find({ movieId: movie.id });
    if (shows.length) throw new ConflictException('Sản phẩm đang gắn với suất chiếu. Hãy xóa suất chiếu trước.');
    await this.movies.remove({ id: movie.id });
  }

  async createRoom(dto: RoomDto) {
    const vipRows = dto.vipRows ?? 0;
    if (vipRows > dto.rows) throw new BadRequestException('Số hàng VIP vượt quá số hàng');
    const room = await this.rooms.save({ name: dto.name.trim() });
    const seats: Partial<CinemaSeat>[] = [];
    for (let r = 0; r < dto.rows; r++) {
      const kind: SeatKind = r >= dto.rows - vipRows ? 'vip' : 'standard';
      for (let c = 1; c <= dto.cols; c++) {
        seats.push({ tenantId: this.tenantId, roomId: room.id, rowLabel: ROWS[r], number: c, kind });
      }
    }
    await this.seatRepo.save(seats);
    return { ...room, seats: seats.length };
  }

  async createShowtime(dto: ShowtimeDto) {
    const movie = await this.movies.findOne({ id: dto.movieId });
    const room = await this.rooms.findOne({ id: dto.roomId });
    if (!movie) throw new BadRequestException('Phim không tồn tại');
    if (!room) throw new BadRequestException('Phòng không tồn tại');
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Giờ chiếu không hợp lệ');
    return this.shows.save({ movieId: movie.id, roomId: room.id, startsAt });
  }

  async seatMap(showtimeId: string) {
    const show = await this.shows.findOne({ id: showtimeId });
    if (!show) throw new NotFoundException('Không tìm thấy suất chiếu');
    const [movie, room, seats, tickets] = await Promise.all([
      this.movies.findOne({ id: show.movieId }),
      this.rooms.findOne({ id: show.roomId }),
      this.seats.find({ roomId: show.roomId }, { order: { rowLabel: 'ASC', number: 'ASC' } }),
      this.tickets.find({ showtimeId }),
    ]);
    if (!movie || !room) throw new NotFoundException('Suất chiếu thiếu phim hoặc phòng');
    const product = await this.products.get(movie.productId);
    const vip = product.variants.find((v) => v.id === movie.vipVariantId);
    const now = new Date();
    const bySeat = new Map(tickets.map((t) => [t.seatId, t]));
    const rows = new Map<string, object[]>();
    for (const seat of seats) {
      const ticket = bySeat.get(seat.id);
      const status = this.taken(ticket, now) ? (ticket!.status === 'sold' ? 'sold' : 'held') : 'free';
      const priceVnd = seat.kind === 'vip' && vip ? vip.priceVnd : product.priceVnd;
      const list = rows.get(seat.rowLabel) ?? [];
      list.push({ id: seat.id, number: seat.number, kind: seat.kind, label: this.label(seat), status, priceVnd });
      rows.set(seat.rowLabel, list);
    }
    return {
      id: show.id,
      startsAt: show.startsAt,
      movieTitle: movie.title,
      durationMin: movie.durationMin,
      roomName: room.name,
      rows: [...rows.entries()].map(([label, rowSeats]) => ({ label, seats: rowSeats })),
    };
  }

  async checkout(dto: CheckoutDto, user: AuthUser) {
    const prior = await this.sales.findOne({ idempotencyKey: dto.idempotencyKey });
    if (prior) {
      const order = await this.orders.get(prior.orderId);
      if (order.status === 'paid') return order;
      return this.collect(order.id, dto);
    }

    const show = await this.shows.findOne({ id: dto.showtimeId });
    if (!show) throw new NotFoundException('Không tìm thấy suất chiếu');
    const movie = await this.movies.findOne({ id: show.movieId });
    if (!movie) throw new NotFoundException('Không tìm thấy phim');
    const unique = [...new Set(dto.seatIds)];
    if (unique.length !== dto.seatIds.length) throw new BadRequestException('Ghế bị chọn trùng');
    const picked = await this.seats.find({ id: In(unique), roomId: show.roomId });
    if (picked.length !== unique.length) throw new BadRequestException('Có ghế không thuộc phòng của suất này');
    picked.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel) || a.number - b.number);
    if (picked.some((s) => s.kind === 'vip') && !movie.vipVariantId) {
      throw new BadRequestException('Phim chưa có giá ghế VIP');
    }

    const now = new Date();
    const holdUntil = new Date(now.getTime() + HOLD_MS);
    await this.ds.transaction(async (m) => {
      const repo = m.getRepository(CinemaTicket);
      for (const seat of picked) {
        const ticket = await repo.findOne({ where: { tenantId: this.tenantId, showtimeId: show.id, seatId: seat.id } });
        if (this.taken(ticket ?? undefined, now, dto.idempotencyKey)) {
          throw new ConflictException(`Ghế ${this.label(seat)} vừa được giữ hoặc đã bán`);
        }
        const row = ticket ?? repo.create({ tenantId: this.tenantId, showtimeId: show.id, seatId: seat.id });
        row.status = 'held';
        row.holdKey = dto.idempotencyKey;
        row.holdUntil = holdUntil;
        row.orderId = null;
        row.orderLineId = null;
        await repo.save(row);
      }
    });

    const when = new Date(show.startsAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    let orderId = '';
    try {
      const created = await this.orders.create({
        lines: picked.map((s) => ({
          productId: movie.productId,
          variantId: s.kind === 'vip' ? movie.vipVariantId ?? undefined : undefined,
          qty: 1,
        })),
        customerId: dto.customerId,
        note: `${movie.title} · ${when} · ${picked.map((s) => this.label(s)).join(', ')}`.slice(0, 200),
      }, user);
      orderId = created.id;
      const lineIds: { id: string }[] = await this.ds.query(
        `SELECT id FROM order_lines WHERE orderId = ? AND tenantId = ? ORDER BY rowid`,
        [orderId, this.tenantId],
      );
      if (lineIds.length !== picked.length) throw new ConflictException('Không gắn được ghế vào đơn');
      for (let i = 0; i < picked.length; i++) {
        const seat = picked[i];
        const lineId = lineIds[i].id;
        await this.lineRepo.update(
          { id: lineId, tenantId: this.tenantId },
          { name: `${movie.title} · ${this.label(seat)}` },
        );
        await this.ticketRepo.update(
          { tenantId: this.tenantId, showtimeId: show.id, seatId: seat.id },
          { orderId, orderLineId: lineId },
        );
      }
      await this.sales.save({ idempotencyKey: dto.idempotencyKey, orderId });
    } catch (e) {
      await this.releaseHold(show.id, picked.map((s) => s.id), dto.idempotencyKey);
      if (orderId) {
        try { await this.orders.void(orderId); } catch { /* đơn đã thu hoặc đã hủy */ }
      }
      throw e;
    }
    return this.collect(orderId, dto);
  }

  private async collect(orderId: string, dto: CheckoutDto) {
    const order = await this.orders.get(orderId);
    if (order.status === 'paid') return order;
    const payments = dto.payments?.length
      ? dto.payments
      : [{ method: 'cash' as const, amountVnd: order.totalVnd }];
    const paid = await this.orders.pay(orderId, { payments, idempotencyKey: dto.idempotencyKey });
    await this.markSold(this.tenantId, orderId);
    return paid;
  }

  private async releaseHold(showtimeId: string, seatIds: string[], holdKey: string) {
    const rows = await this.ticketRepo.find({ where: { tenantId: this.tenantId, showtimeId, holdKey, status: 'held' } });
    for (const row of rows) {
      if (!seatIds.includes(row.seatId)) continue;
      row.status = 'refunded';
      row.holdKey = null;
      row.holdUntil = null;
      await this.ticketRepo.save(row);
    }
  }

  async markSold(tenantId: string, orderId: string) {
    await this.ticketRepo.update(
      { tenantId, orderId, status: 'held' },
      { status: 'sold', holdKey: null, holdUntil: null },
    );
  }

  async releaseOrder(tenantId: string, orderId: string) {
    const rows = await this.ticketRepo.find({ where: { tenantId, orderId, status: 'held' } });
    for (const row of rows) {
      row.status = 'refunded';
      row.holdKey = null;
      row.holdUntil = null;
      await this.ticketRepo.save(row);
    }
  }

  async releaseRefund(tenantId: string, refundId: string) {
    const lines: { orderLineId: string; qty: number }[] = await this.ds.query(
      `SELECT orderLineId, qty FROM refund_lines WHERE refundId = ? AND tenantId = ?`,
      [refundId, tenantId],
    );
    for (const line of lines) {
      const tickets = await this.ticketRepo.find({
        where: { tenantId, orderLineId: line.orderLineId, status: 'sold' },
        take: line.qty,
      });
      for (const ticket of tickets) {
        ticket.status = 'refunded';
        await this.ticketRepo.save(ticket);
      }
    }
  }
}
