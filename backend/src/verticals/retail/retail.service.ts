import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { OrderService } from '../../core/order/order.service';
import { ProductService } from '../../core/product/product.service';
import { CreateReturnDto } from './retail.dto';
import { RetailReturn, RetailReturnLine } from './retail.entity';

@Injectable()
export class RetailService {
  private returns: TenantRepository<RetailReturn>;
  private lines: TenantRepository<RetailReturnLine>;

  constructor(
    @InjectRepository(RetailReturn) returns: Repository<RetailReturn>,
    @InjectRepository(RetailReturnLine) lines: Repository<RetailReturnLine>,
    cls: ClsService,
    private readonly orders: OrderService,
    private readonly products: ProductService,
  ) {
    this.returns = new TenantRepository(returns, cls);
    this.lines = new TenantRepository(lines, cls);
  }

  lookup(code: string) {
    return this.products.findByCode(code);
  }

  async list() {
    const rows = await this.returns.find({}, { order: { createdAt: 'DESC' }, take: 100 });
    const lines = await this.lines.find({});
    return { returns: rows.map((r) => ({ ...r, lines: lines.filter((l) => l.returnId === r.id) })) };
  }

  async one(id: string) {
    const row = await this.returns.findOne({ id });
    if (!row) throw new NotFoundException('Không tìm thấy phiếu đổi trả');
    const lines = await this.lines.find({ returnId: id });
    return { ...row, lines };
  }

  /** Phiếu đổi trả gắn đơn đã thu và hoàn đúng số lượng — không xóa đơn. */
  async create(dto: CreateReturnDto, user: AuthUser) {
    const existing = await this.returns.findOne({ idempotencyKey: dto.idempotencyKey });
    if (existing) return this.one(existing.id);

    const order = await this.orders.refund(dto.orderId, {
      lines: dto.lines.map((l) => ({ lineId: l.orderLineId, qty: l.qty })),
      idempotencyKey: dto.idempotencyKey,
      reason: dto.note?.trim() || 'Đổi trả',
    }, user);
    const refund = order.refunds.find((r) => r.idempotencyKey === dto.idempotencyKey);
    if (!refund) throw new BadRequestException('Không tạo được phiếu hoàn');

    const saved = await this.returns.save({
      orderId: dto.orderId,
      refundId: refund.id,
      totalVnd: refund.amountVnd,
      note: dto.note?.trim() || null,
      idempotencyKey: dto.idempotencyKey,
      createdBy: user.userId,
    });
    const names = new Map(order.lines.map((l) => [l.id, l.name]));
    for (const rl of refund.lines) {
      await this.lines.save({
        returnId: saved.id,
        orderLineId: rl.orderLineId,
        name: names.get(rl.orderLineId) ?? '',
        qty: rl.qty,
        amountVnd: rl.amountVnd,
      });
    }
    return this.one(saved.id);
  }
}
