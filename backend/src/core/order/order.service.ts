import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { DataSource, In, Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { TenantService } from '../../platform/tenant/tenant.service';
import { CustomerService } from '../customer/customer.service';
import { ProductService } from '../product/product.service';
import { CreateOrderDto, MergeOrderDto, PayOrderDto, PreviewOrderDto, RefundDto, SplitOrderDto } from './order.dto';
import { Order, OrderLine, OrderLineOption, OrderStatus, Payment, Refund, RefundLine } from './order.entity';
import { MoneyError, calcTotals, lineRefundVnd, settlePayments } from './money';

function startOfTodayVietnam(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return new Date(`${y}-${m}-${d}T00:00:00+07:00`);
}

@Injectable()
export class OrderService {
  private orders: TenantRepository<Order>;
  private lines: TenantRepository<OrderLine>;
  private payments: TenantRepository<Payment>;
  private refunds: TenantRepository<Refund>;
  private refundLines: TenantRepository<RefundLine>;
  private lineOptions: TenantRepository<OrderLineOption>;

  constructor(
    @InjectRepository(Order) o: Repository<Order>,
    @InjectRepository(OrderLine) l: Repository<OrderLine>,
    @InjectRepository(Payment) p: Repository<Payment>,
    @InjectRepository(Refund) r: Repository<Refund>,
    @InjectRepository(RefundLine) rl: Repository<RefundLine>,
    @InjectRepository(OrderLineOption) opts: Repository<OrderLineOption>,
    private readonly ds: DataSource,
    private readonly cls: ClsService,
    private readonly products: ProductService,
    private readonly customers: CustomerService,
    private readonly tenants: TenantService,
    private readonly events: EventEmitter2,
  ) {
    this.orders = new TenantRepository(o, cls);
    this.lines = new TenantRepository(l, cls);
    this.payments = new TenantRepository(p, cls);
    this.refunds = new TenantRepository(r, cls);
    this.refundLines = new TenantRepository(rl, cls);
    this.lineOptions = new TenantRepository(opts, cls);
  }

  private get tenantId(): string {
    return this.cls.get('tenantId');
  }

  private money<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (e instanceof MoneyError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** Giá luôn lấy từ DB, thuế lấy từ cấu hình tenant. */
  private async price(dto: PreviewOrderDto) {
    const items = await this.products.resolveForSale(dto.lines);
    const { settings } = await this.tenants.getOrFail(this.tenantId);
    const taxRatePercent = settings.taxRatePercent ?? 0;
    const taxMode = settings.taxMode ?? 'inclusive';
    const totals = this.money(() => calcTotals(items, { discount: dto.discount ?? null, taxRatePercent, taxMode }));
    return { items, totals, taxRatePercent, taxMode };
  }

  async preview(dto: PreviewOrderDto) {
    const { items, totals } = await this.price(dto);
    return { ...totals, lines: items };
  }

  async create(dto: CreateOrderDto, user: AuthUser) {
    if (dto.customerId && !(await this.customers.getOptional(dto.customerId))) {
      throw new BadRequestException('Khách hàng không tồn tại');
    }
    const { items, totals, taxRatePercent, taxMode } = await this.price(dto);
    const tenantId = this.tenantId;
    const id = await this.ds.transaction(async (m) => {
      const orderRepo = m.getRepository(Order);
      const row = await orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(MAX(o.seq), 0)', 'max')
        .where('o.tenantId = :tenantId', { tenantId })
        .getRawOne();
      const order = await orderRepo.save(
        orderRepo.create({
          tenantId,
          seq: Number(row.max) + 1,
          status: 'open',
          ...totals,
          taxRatePercent,
          taxMode,
          discountType: dto.discount?.type ?? null,
          discountValue: dto.discount?.value ?? null,
          note: dto.note?.trim() || null,
          customerId: dto.customerId ?? null,
          createdBy: user.userId,
        }),
      );
      const lineRepo = m.getRepository(OrderLine);
      const saved = await lineRepo.save(items.map((i) => lineRepo.create({
        tenantId, orderId: order.id,
        productId: i.productId, variantId: i.variantId, name: i.name,
        unitPriceVnd: i.unitPriceVnd, qty: i.qty, lineTotalVnd: i.lineTotalVnd, note: i.note,
      })));
      const optRepo = m.getRepository(OrderLineOption);
      const snapshots = saved.flatMap((line, idx) => items[idx].options.map((o) => optRepo.create({
        tenantId, orderLineId: line.id, name: o.name, extraVnd: o.extraVnd,
      })));
      if (snapshots.length) await optRepo.save(snapshots);
      return order.id;
    });
    await this.events.emitAsync('order.created', { tenantId, orderId: id });
    return this.get(id);
  }

  async summary() {
    const rows = await this.orders.find({});
    const start = startOfTodayVietnam().getTime();
    const out = { todayRevenueVnd: 0, todayPaidCount: 0, openCount: 0, paidCount: 0 };
    for (const o of rows) {
      if (o.status === 'open') out.openCount += 1;
      if (o.status === 'paid') {
        out.paidCount += 1;
        const at = o.paidAt ? new Date(o.paidAt).getTime() : 0;
        if (at >= start) {
          out.todayPaidCount += 1;
          out.todayRevenueVnd += o.totalVnd - (o.refundedVnd ?? 0);
        }
      }
    }
    return out;
  }

  async list(status?: string) {
    const ok: OrderStatus[] = ['open', 'paid', 'void'];
    const where = ok.includes(status as OrderStatus) ? { status: status as OrderStatus } : {};
    const orders = await this.orders.find(where, { order: { seq: 'DESC' }, take: 100 });
    const ids = [...new Set(orders.map((o) => o.customerId).filter((id): id is string => !!id))];
    const people = await this.customers.listByIds(ids);
    const names = new Map(people.map((c) => [c.id, c.name]));
    return orders.map((o) => ({ ...o, customerName: o.customerId ? names.get(o.customerId) ?? null : null }));
  }

  async get(id: string) {
    const order = await this.orders.findOne({ id });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    const [lines, payments, refundRows] = await Promise.all([
      this.lines.find({ orderId: id }, { order: { name: 'ASC' } }),
      this.payments.find({ orderId: id }, { order: { createdAt: 'ASC' } }),
      this.refunds.find({ orderId: id }, { order: { createdAt: 'ASC' } }),
    ]);
    const lineIds = lines.map((l) => l.id);
    const optionRows = lineIds.length ? await this.lineOptions.find({ orderLineId: In(lineIds) }) : [];
    const refundIds = refundRows.map((r) => r.id);
    const refundLineRows = refundIds.length ? await this.refundLines.find({ refundId: In(refundIds) }) : [];
    const customer = order.customerId ? await this.customers.getOptional(order.customerId) : null;
    return {
      ...order,
      lines: lines.map((l) => ({ ...l, options: optionRows.filter((o) => o.orderLineId === l.id) })),
      payments,
      customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
      refunds: refundRows.map((r) => ({ ...r, lines: refundLineRows.filter((l) => l.refundId === r.id) })),
    };
  }

  async pay(id: string, dto: PayOrderDto) {
    const tenantId = this.tenantId;
    const replay = await this.ds.transaction(async (m) => {
      const orders = new TenantRepository(m.getRepository(Order), this.cls);
      const order = await orders.findOne({ id });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status === 'paid') {
        if (order.paidKey === dto.idempotencyKey) return true;
        throw new ConflictException('Đơn này đã được thanh toán');
      }
      if (order.status !== 'open') throw new ConflictException('Đơn đã bị hủy, không thể thanh toán');

      const { changeVnd } = this.money(() => settlePayments(order.totalVnd, dto.payments));

      const res = await m
        .getRepository(Order)
        .update({ id, tenantId, status: 'open' }, { status: 'paid', paidKey: dto.idempotencyKey, changeVnd, paidAt: new Date() });
      if (!res.affected) throw new ConflictException('Đơn vừa được xử lý ở nơi khác, hãy tải lại');

      const payRepo = m.getRepository(Payment);
      await payRepo.save(dto.payments.map((p) => payRepo.create({ tenantId, orderId: id, method: p.method, amountVnd: p.amountVnd })));
      return false;
    });
    if (!replay) await this.events.emitAsync('order.paid', { tenantId, orderId: id });
    return this.get(id);
  }

  /** Chỉ hủy được đơn chưa thanh toán. Đơn đã thu tiền dùng hoàn tiền, không xóa. */
  async void(id: string) {
    const tenantId = this.tenantId;
    await this.get(id);
    const res = await this.ds.getRepository(Order).update({ id, tenantId, status: 'open' }, { status: 'void' });
    if (!res.affected) throw new ConflictException('Chỉ hủy được đơn chưa thanh toán');
    await this.events.emitAsync('order.voided', { tenantId, orderId: id });
    return this.get(id);
  }

  /**
   * Hoàn một phần hoặc toàn bộ đơn đã thanh toán. Gửi lại cùng idempotencyKey không hoàn thêm.
   * Khi hoàn hết mọi dòng, bù làm tròn để tổng hoàn đúng bằng số đã thu.
   */
  async refund(id: string, dto: RefundDto, user: AuthUser) {
    const tenantId = this.tenantId;
    let refundId = '';
    const replay = await this.ds.transaction(async (m) => {
      const refundRepo = m.getRepository(Refund);
      const prev = await refundRepo.findOne({ where: { tenantId, idempotencyKey: dto.idempotencyKey } });
      if (prev) {
        if (prev.orderId !== id) throw new ConflictException('Khóa này đã dùng cho đơn khác');
        return true;
      }
      const order = await m.getRepository(Order).findOne({ where: { id, tenantId } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'paid') throw new ConflictException('Chỉ hoàn tiền đơn đã thanh toán');

      const lineRepo = m.getRepository(OrderLine);
      const allLines = await lineRepo.find({ where: { orderId: id, tenantId } });
      const drafted: { line: OrderLine; qty: number; amountVnd: number }[] = [];
      let amount = 0;
      if (dto.lines?.length) {
        const seen = new Set<string>();
        for (const req of dto.lines) {
          if (seen.has(req.lineId)) throw new BadRequestException('Dòng hàng bị chọn trùng');
          seen.add(req.lineId);
          const line = allLines.find((l) => l.id === req.lineId);
          if (!line) throw new BadRequestException('Dòng hàng không thuộc đơn này');
          const left = line.qty - line.refundedQty;
          if (req.qty > left) throw new BadRequestException('Số lượng hoàn vượt quá số còn lại');
          const amountVnd = this.money(() => lineRefundVnd(order, line, req.qty));
          drafted.push({ line, qty: req.qty, amountVnd });
          amount += amountVnd;
        }
        const fully = allLines.every((l) => l.refundedQty + (dto.lines!.find((r) => r.lineId === l.id)?.qty ?? 0) === l.qty);
        if (fully && drafted.length) {
          const target = order.totalVnd - order.refundedVnd;
          drafted[drafted.length - 1].amountVnd += target - amount;
          amount = target;
        }
      } else if (dto.amountVnd) {
        amount = dto.amountVnd;
      } else {
        throw new BadRequestException('Cần số tiền hoặc dòng hàng để hoàn');
      }
      if (!Number.isInteger(amount) || amount < 1) throw new BadRequestException('Số tiền hoàn không hợp lệ');

      const res = await m
        .getRepository(Order)
        .createQueryBuilder()
        .update(Order)
        .set({ refundedVnd: () => `refundedVnd + ${amount}` })
        .where('id = :id AND tenantId = :tenantId AND status = :status AND refundedVnd + :amount <= totalVnd', {
          id, tenantId, status: 'paid', amount,
        })
        .execute();
      if (!res.affected) throw new BadRequestException('Số hoàn vượt quá số đã thu');

      for (const d of drafted) {
        await lineRepo.update({ id: d.line.id, tenantId }, { refundedQty: d.line.refundedQty + d.qty });
      }
      const saved = await refundRepo.save(refundRepo.create({
        tenantId,
        orderId: id,
        amountVnd: amount,
        reason: dto.reason?.trim() || null,
        idempotencyKey: dto.idempotencyKey,
        createdBy: user.userId,
      }));
      if (drafted.length) {
        const rlRepo = m.getRepository(RefundLine);
        await rlRepo.save(drafted.map((d) => rlRepo.create({
          tenantId, refundId: saved.id, orderLineId: d.line.id, qty: d.qty, amountVnd: d.amountVnd,
        })));
      }
      refundId = saved.id;
      return false;
    });
    if (!replay) await this.events.emitAsync('order.refunded', { tenantId, orderId: id, refundId });
    return this.get(id);
  }

  private async persistTotals(orderRepo: Repository<Order>, lineRepo: Repository<OrderLine>, order: Order, tenantId: string) {
    const lines = await lineRepo.find({ where: { orderId: order.id, tenantId } });
    const totals = this.money(() => calcTotals(
      lines.map((l) => ({ unitPriceVnd: l.unitPriceVnd, qty: l.qty })),
      {
        discount: order.discountType ? { type: order.discountType, value: order.discountValue ?? 0 } : null,
        taxRatePercent: order.taxRatePercent,
        taxMode: order.taxMode,
      },
    ));
    await orderRepo.update({ id: order.id, tenantId }, totals);
  }

  /** Tách một phần dòng sang đơn mở mới. Giảm giá % được giữ ở cả hai; giảm giá số tiền ở lại đơn gốc. */
  async split(orderId: string, dto: SplitOrderDto, user: AuthUser) {
    const tenantId = this.tenantId;
    const createdId = await this.ds.transaction(async (m) => {
      const orderRepo = m.getRepository(Order);
      const lineRepo = m.getRepository(OrderLine);
      const order = await orderRepo.findOne({ where: { id: orderId, tenantId } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (order.status !== 'open') throw new ConflictException('Chỉ tách được đơn chưa thanh toán');
      const lines = await lineRepo.find({ where: { orderId, tenantId } });
      const byId = new Map(lines.map((l) => [l.id, l]));
      const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
      let moveUnits = 0;
      const seen = new Set<string>();
      for (const p of dto.lines) {
        if (seen.has(p.lineId)) throw new BadRequestException('Dòng hàng bị chọn trùng');
        seen.add(p.lineId);
        const line = byId.get(p.lineId);
        if (!line) throw new BadRequestException('Dòng hàng không thuộc đơn này');
        if (p.qty > line.qty) throw new BadRequestException('Số lượng tách không hợp lệ');
        moveUnits += p.qty;
      }
      if (moveUnits >= totalUnits) throw new BadRequestException('Phải để lại ít nhất một món ở đơn gốc');

      const seqRow = await orderRepo.createQueryBuilder('o').select('COALESCE(MAX(o.seq), 0)', 'max').where('o.tenantId = :tenantId', { tenantId }).getRawOne();
      const created = await orderRepo.save(orderRepo.create({
        tenantId,
        seq: Number(seqRow.max) + 1,
        status: 'open',
        subtotalVnd: 0,
        discountVnd: 0,
        taxVnd: 0,
        totalVnd: 0,
        taxRatePercent: order.taxRatePercent,
        taxMode: order.taxMode,
        discountType: order.discountType === 'percent' ? 'percent' : null,
        discountValue: order.discountType === 'percent' ? order.discountValue : null,
        note: `Tách từ #${String(order.seq).padStart(4, '0')}`,
        customerId: order.customerId,
        createdBy: user.userId,
      }));

      for (const p of dto.lines) {
        const line = byId.get(p.lineId)!;
        if (p.qty === line.qty) {
          line.orderId = created.id;
          await lineRepo.save(line);
        } else {
          const copied = await lineRepo.save(lineRepo.create({
            tenantId,
            orderId: created.id,
            productId: line.productId,
            variantId: line.variantId,
            name: line.name,
            unitPriceVnd: line.unitPriceVnd,
            qty: p.qty,
            lineTotalVnd: line.unitPriceVnd * p.qty,
            note: line.note,
          }));
          const optRepo = m.getRepository(OrderLineOption);
          const opts = await optRepo.find({ where: { tenantId, orderLineId: line.id } });
          if (opts.length) {
            await optRepo.save(opts.map((o) => optRepo.create({
              tenantId, orderLineId: copied.id, name: o.name, extraVnd: o.extraVnd,
            })));
          }
          line.qty -= p.qty;
          line.lineTotalVnd = line.unitPriceVnd * line.qty;
          await lineRepo.save(line);
        }
      }
      await this.persistTotals(orderRepo, lineRepo, order, tenantId);
      await this.persistTotals(orderRepo, lineRepo, created, tenantId);
      return created.id;
    });
    await this.events.emitAsync('order.created', { tenantId, orderId: createdId });
    return { source: await this.get(orderId), created: await this.get(createdId) };
  }

  /** Gộp mọi dòng của đơn nguồn vào đơn đích, rồi hủy đơn nguồn (đơn nguồn chưa thu tiền). */
  async merge(dto: MergeOrderDto) {
    if (dto.targetOrderId === dto.sourceOrderId) throw new BadRequestException('Chọn hai đơn khác nhau');
    const tenantId = this.tenantId;
    await this.ds.transaction(async (m) => {
      const orderRepo = m.getRepository(Order);
      const lineRepo = m.getRepository(OrderLine);
      const target = await orderRepo.findOne({ where: { id: dto.targetOrderId, tenantId } });
      const source = await orderRepo.findOne({ where: { id: dto.sourceOrderId, tenantId } });
      if (!target || !source) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (target.status !== 'open' || source.status !== 'open') throw new ConflictException('Chỉ gộp được đơn chưa thanh toán');
      const moved = await lineRepo.update({ orderId: dto.sourceOrderId, tenantId }, { orderId: dto.targetOrderId });
      if (!moved.affected) throw new BadRequestException('Đơn nguồn không có món để gộp');
      await this.persistTotals(orderRepo, lineRepo, target, tenantId);
      const res = await orderRepo.update({ id: dto.sourceOrderId, tenantId, status: 'open' }, { status: 'void' });
      if (!res.affected) throw new ConflictException('Đơn nguồn vừa được xử lý ở nơi khác');
    });
    await this.events.emitAsync('order.voided', { tenantId, orderId: dto.sourceOrderId });
    return this.get(dto.targetOrderId);
  }
}
