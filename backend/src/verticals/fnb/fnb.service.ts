import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { MergeOrderDto, SplitOrderDto } from '../../core/order/order.dto';
import { Order, OrderLine } from '../../core/order/order.entity';
import { OrderService } from '../../core/order/order.service';
import { ProductService } from '../../core/product/product.service';
import { AreaDto, AssignTableDto, RecipeDto, TableDto, TicketStatusDto, UpdateTableDto } from './fnb.dto';
import { FnbArea, FnbRecipe, FnbRecipeItem, FnbTable, FnbTicket, FnbTicketLine, TicketStatus } from './fnb.entity';

@Injectable()
export class FnbService {
  private areas: TenantRepository<FnbArea>;
  private tables: TenantRepository<FnbTable>;
  private recipes: TenantRepository<FnbRecipe>;
  private recipeItems: TenantRepository<FnbRecipeItem>;

  constructor(
    @InjectRepository(FnbArea) areaRepo: Repository<FnbArea>,
    @InjectRepository(FnbTable) private readonly tableRepo: Repository<FnbTable>,
    @InjectRepository(FnbTicket) private readonly ticketRepo: Repository<FnbTicket>,
    @InjectRepository(FnbTicketLine) private readonly ticketLineRepo: Repository<FnbTicketLine>,
    @InjectRepository(FnbRecipe) recipeRepo: Repository<FnbRecipe>,
    @InjectRepository(FnbRecipeItem) recipeItemRepo: Repository<FnbRecipeItem>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderLine) private readonly orderLineRepo: Repository<OrderLine>,
    private readonly cls: ClsService,
    private readonly orders: OrderService,
    private readonly products: ProductService,
  ) {
    this.areas = new TenantRepository(areaRepo, cls);
    this.tables = new TenantRepository(tableRepo, cls);
    this.recipes = new TenantRepository(recipeRepo, cls);
    this.recipeItems = new TenantRepository(recipeItemRepo, cls);
  }

  private get tenantId() {
    return this.cls.get('tenantId') as string;
  }

  async floor() {
    const [areas, tables] = await Promise.all([
      this.areas.find({}, { order: { sortOrder: 'ASC', name: 'ASC' } }),
      this.tables.find({}, { order: { name: 'ASC' } }),
    ]);
    return { areas, tables };
  }

  createArea(dto: AreaDto) {
    return this.areas.save({ name: dto.name.trim(), sortOrder: 0 });
  }

  async updateArea(id: string, dto: AreaDto) {
    const area = await this.areas.findOne({ id });
    if (!area) throw new NotFoundException('Không tìm thấy khu vực');
    await this.areas.save({ id, name: dto.name.trim() });
    return this.areas.findOne({ id });
  }

  async deleteArea(id: string) {
    const area = await this.areas.findOne({ id });
    if (!area) throw new NotFoundException('Không tìm thấy khu vực');
    const tables = await this.tables.find({ areaId: id });
    if (tables.length) throw new ConflictException('Hãy xóa bàn trong khu vực trước');
    await this.areas.remove({ id });
    return { ok: true };
  }

  async createTable(dto: TableDto) {
    const area = await this.areas.findOne({ id: dto.areaId });
    if (!area) throw new BadRequestException('Khu vực không tồn tại');
    return this.tables.save({ areaId: dto.areaId, name: dto.name.trim(), seats: dto.seats ?? 4, status: 'free', orderId: null });
  }

  async updateTable(id: string, dto: UpdateTableDto) {
    const table = await this.tables.findOne({ id });
    if (!table) throw new NotFoundException('Không tìm thấy bàn');
    if (dto.areaId && !(await this.areas.findOne({ id: dto.areaId }))) throw new BadRequestException('Khu vực không tồn tại');
    await this.tables.save({
      id,
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.seats !== undefined && { seats: dto.seats }),
      ...(dto.areaId !== undefined && { areaId: dto.areaId }),
    });
    return this.tables.findOne({ id });
  }

  async deleteTable(id: string) {
    const table = await this.tables.findOne({ id });
    if (!table) throw new NotFoundException('Không tìm thấy bàn');
    if (table.orderId || table.status !== 'free') throw new ConflictException('Chỉ xóa được bàn trống');
    await this.tables.remove({ id });
    return { ok: true };
  }

  async assign(id: string, dto: AssignTableDto) {
    const table = await this.tables.findOne({ id });
    if (!table) throw new NotFoundException('Không tìm thấy bàn');
    const order = await this.orders.get(dto.orderId);
    if (order.status !== 'open') throw new BadRequestException('Chỉ gán được đơn chưa thanh toán');
    const holders = await this.tableRepo.find({ where: { tenantId: this.tenantId, orderId: dto.orderId } });
    for (const other of holders) {
      if (other.id !== table.id) await this.tables.save({ id: other.id, status: 'free', orderId: null });
    }
    if (table.orderId && table.orderId !== dto.orderId) {
      const current = await this.orderRepo.findOne({ where: { id: table.orderId, tenantId: this.tenantId } });
      if (current?.status === 'open') throw new ConflictException('Bàn đang có đơn khác');
    }
    await this.tables.save({ id: table.id, status: 'occupied', orderId: dto.orderId });
    return this.floor();
  }

  async clear(id: string) {
    const table = await this.tables.findOne({ id });
    if (!table) throw new NotFoundException('Không tìm thấy bàn');
    if (table.orderId) {
      const order = await this.orderRepo.findOne({ where: { id: table.orderId, tenantId: this.tenantId } });
      if (order?.status === 'open') throw new ConflictException('Hãy thanh toán hoặc hủy đơn trước khi trả bàn');
    }
    await this.tables.save({ id, status: 'free', orderId: null });
    return this.floor();
  }

  /** Gọi từ listener: tenantId lấy từ sự kiện, không phụ thuộc request context. */
  async openTicket(tenantId: string, orderId: string) {
    const exists = await this.ticketRepo.findOne({ where: { tenantId, orderId } });
    if (exists) return;
    const lines = await this.orderLineRepo.find({ where: { tenantId, orderId } });
    if (!lines.length) return;
    const ticket = await this.ticketRepo.save(this.ticketRepo.create({ tenantId, orderId, status: 'queued' }));
    await this.ticketLineRepo.save(lines.map((l) => this.ticketLineRepo.create({
      tenantId, ticketId: ticket.id, name: l.name, qty: l.qty,
    })));
  }

  async closeOrder(tenantId: string, orderId: string) {
    await this.tableRepo.update({ tenantId, orderId }, { status: 'free', orderId: null });
    await this.ticketRepo.update({ tenantId, orderId }, { status: 'served' });
  }

  async resyncQueuedTicket(orderId: string) {
    const tenantId = this.tenantId;
    const ticket = await this.ticketRepo.findOne({ where: { tenantId, orderId } });
    if (!ticket || ticket.status !== 'queued') return;
    await this.ticketLineRepo.delete({ tenantId, ticketId: ticket.id });
    const lines = await this.orderLineRepo.find({ where: { tenantId, orderId } });
    if (!lines.length) return;
    await this.ticketLineRepo.save(lines.map((l) => this.ticketLineRepo.create({
      tenantId, ticketId: ticket.id, name: l.name, qty: l.qty,
    })));
  }

  async tickets() {
    const tenantId = this.tenantId;
    const tickets = await this.ticketRepo.find({
      where: { tenantId, status: In(['queued', 'cooking', 'ready'] as TicketStatus[]) },
      order: { createdAt: 'ASC' },
    });
    if (!tickets.length) return { tickets: [] };
    const ids = tickets.map((t) => t.id);
    const orderIds = tickets.map((t) => t.orderId);
    const [lines, orders] = await Promise.all([
      this.ticketLineRepo.find({ where: { tenantId, ticketId: In(ids) } }),
      this.orderRepo.find({ where: { tenantId, id: In(orderIds) } }),
    ]);
    const seqOf = new Map(orders.map((o) => [o.id, o.seq]));
    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        orderId: t.orderId,
        seq: seqOf.get(t.orderId) ?? 0,
        status: t.status,
        createdAt: t.createdAt,
        lines: lines.filter((l) => l.ticketId === t.id).map((l) => ({ id: l.id, name: l.name, qty: l.qty })),
      })),
    };
  }

  async setTicketStatus(id: string, dto: TicketStatusDto) {
    const ticket = await this.ticketRepo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!ticket) throw new NotFoundException('Không tìm thấy phiếu bếp');
    ticket.status = dto.status;
    await this.ticketRepo.save(ticket);
    return this.tickets();
  }

  async listRecipes() {
    const recipes = await this.recipes.find({}, { order: { name: 'ASC' } });
    const items = await this.recipeItems.find({});
    return { recipes: recipes.map((r) => ({ ...r, items: items.filter((i) => i.recipeId === r.id) })) };
  }

  async saveRecipe(dto: RecipeDto) {
    const product = await this.products.get(dto.productId);
    let recipe = await this.recipes.findOne({ productId: dto.productId });
    const name = dto.name?.trim() || product.name;
    if (!recipe) recipe = await this.recipes.save({ productId: dto.productId, name });
    else await this.recipes.save({ id: recipe.id, name });
    await this.recipeItems.remove({ recipeId: recipe.id });
    for (const it of dto.items) {
      await this.recipeItems.save({ recipeId: recipe.id, name: it.name.trim(), qty: it.qty, unit: it.unit.trim() });
    }
    const items = await this.recipeItems.find({ recipeId: recipe.id });
    return { ...recipe, name, items };
  }

  async dropForProduct(productId: string) {
    const recipe = await this.recipes.findOne({ productId });
    if (recipe) await this.deleteRecipe(recipe.id);
  }

  async deleteRecipe(id: string) {
    const recipe = await this.recipes.findOne({ id });
    if (!recipe) throw new NotFoundException('Không tìm thấy công thức');
    await this.recipeItems.remove({ recipeId: id });
    await this.recipes.remove({ id });
    return { ok: true };
  }

  async split(orderId: string, dto: SplitOrderDto, user: AuthUser) {
    const result = await this.orders.split(orderId, dto, user);
    await this.resyncQueuedTicket(orderId);
    return result;
  }

  merge(dto: MergeOrderDto) {
    return this.orders.merge(dto);
  }
}
