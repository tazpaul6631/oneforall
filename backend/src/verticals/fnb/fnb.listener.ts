import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EntitlementService } from '../../platform/entitlement/entitlement.service';
import { OrderEvent } from '../../core/order/order.lifecycle';
import { ProductDeletedEvent } from '../../core/product/product.service';
import { FnbService } from './fnb.service';

@Injectable()
export class FnbListener {
  private readonly log = new Logger(FnbListener.name);

  constructor(
    private readonly fnb: FnbService,
    private readonly entitlement: EntitlementService,
  ) {}

  private async run(fn: () => Promise<unknown>) {
    try { await fn(); } catch (e) { this.log.error(e); }
  }

  @OnEvent('product.deleted')
  productDeleted(e: ProductDeletedEvent) {
    return this.fnb.dropForProduct(e.productId);
  }

  @OnEvent('order.created')
  created(e: OrderEvent) {
    return this.run(async () => {
      if (await this.entitlement.has(e.tenantId, 'fnb.kds')) await this.fnb.openTicket(e.tenantId, e.orderId);
    });
  }

  @OnEvent('order.paid')
  paid(e: OrderEvent) {
    return this.onClosed(e);
  }

  @OnEvent('order.voided')
  voided(e: OrderEvent) {
    return this.onClosed(e);
  }

  private onClosed(e: OrderEvent) {
    return this.run(async () => {
      const features = await Promise.all([
        this.entitlement.has(e.tenantId, 'fnb.table_map'),
        this.entitlement.has(e.tenantId, 'fnb.kds'),
      ]);
      if (features.some(Boolean)) await this.fnb.closeOrder(e.tenantId, e.orderId);
    });
  }
}
