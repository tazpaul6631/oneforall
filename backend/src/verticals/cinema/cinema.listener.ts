import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrderEvent, RefundEvent } from '../../core/order/order.lifecycle';
import { EntitlementService } from '../../platform/entitlement/entitlement.service';
import { CinemaService } from './cinema.service';

@Injectable()
export class CinemaListener {
  private readonly log = new Logger(CinemaListener.name);

  constructor(
    private readonly cinema: CinemaService,
    private readonly entitlement: EntitlementService,
  ) {}

  private async run(fn: () => Promise<unknown>) {
    try { await fn(); } catch (e) { this.log.error(e); }
  }

  @OnEvent('order.paid')
  paid(e: OrderEvent) {
    return this.run(async () => {
      if (await this.entitlement.has(e.tenantId, 'cinema.seat_map')) await this.cinema.markSold(e.tenantId, e.orderId);
    });
  }

  @OnEvent('order.voided')
  voided(e: OrderEvent) {
    return this.run(async () => {
      if (await this.entitlement.has(e.tenantId, 'cinema.seat_map')) await this.cinema.releaseOrder(e.tenantId, e.orderId);
    });
  }

  @OnEvent('order.refunded')
  refunded(e: RefundEvent) {
    return this.run(async () => {
      if (await this.entitlement.has(e.tenantId, 'cinema.seat_map')) await this.cinema.releaseRefund(e.tenantId, e.refundId);
    });
  }
}
