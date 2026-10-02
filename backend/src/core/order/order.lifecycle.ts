import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { StockService } from '../inventory/stock.service';
import { OrderLine, RefundLine } from './order.entity';

export interface OrderEvent { tenantId: string; orderId: string }
export interface RefundEvent extends OrderEvent { refundId: string }

/** Việc kèm theo đơn: ghi audit và trừ/cộng tồn. Lỗi ở đây không được làm hỏng thu tiền. */
@Injectable()
export class OrderLifecycleListener {
  private readonly log = new Logger(OrderLifecycleListener.name);

  constructor(
    private readonly audit: AuditService,
    private readonly stock: StockService,
    private readonly cls: ClsService,
    @InjectRepository(OrderLine) private readonly lines: Repository<OrderLine>,
    @InjectRepository(RefundLine) private readonly refundLines: Repository<RefundLine>,
  ) {}

  private actor() {
    return (this.cls.get('userId') as string | undefined) ?? null;
  }

  private async run(fn: () => Promise<unknown>) {
    try { await fn(); } catch (e) { this.log.error(e); }
  }

  @OnEvent('order.created')
  created(e: OrderEvent) {
    return this.run(() => this.audit.write({
      tenantId: e.tenantId, actorId: this.actor(), action: 'order.created', entityType: 'order', entityId: e.orderId,
    }));
  }

  @OnEvent('order.paid')
  paid(e: OrderEvent) {
    const actorId = this.actor();
    return this.run(async () => {
      const lines = await this.lines.find({ where: { tenantId: e.tenantId, orderId: e.orderId } });
      for (const line of lines) {
        await this.stock.applyIfTracked(e.tenantId, {
          productId: line.productId,
          variantId: line.variantId,
          delta: -line.qty,
          reason: 'sale',
          refType: 'order_line',
          refId: line.id,
        });
      }
      await this.audit.write({
        tenantId: e.tenantId, actorId, action: 'order.paid', entityType: 'order', entityId: e.orderId,
      });
    });
  }

  @OnEvent('order.voided')
  voided(e: OrderEvent) {
    return this.run(() => this.audit.write({
      tenantId: e.tenantId, actorId: this.actor(), action: 'order.voided', entityType: 'order', entityId: e.orderId,
    }));
  }

  @OnEvent('order.refunded')
  refunded(e: RefundEvent) {
    const actorId = this.actor();
    return this.run(async () => {
      const lines = await this.refundLines.find({ where: { tenantId: e.tenantId, refundId: e.refundId } });
      for (const rl of lines) {
        const ol = await this.lines.findOne({ where: { id: rl.orderLineId, tenantId: e.tenantId } });
        if (!ol) continue;
        await this.stock.applyIfTracked(e.tenantId, {
          productId: ol.productId,
          variantId: ol.variantId,
          delta: rl.qty,
          reason: 'refund',
          refType: 'refund_line',
          refId: rl.id,
        });
      }
      await this.audit.write({
        tenantId: e.tenantId,
        actorId,
        action: 'order.refunded',
        entityType: 'order',
        entityId: e.orderId,
        detail: { refundId: e.refundId },
      });
    });
  }
}
