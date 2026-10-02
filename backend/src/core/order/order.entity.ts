import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { TaxMode } from './money';

export type OrderStatus = 'open' | 'paid' | 'void';

@Entity('orders')
@Unique(['tenantId', 'seq'])
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column({ type: 'integer' }) seq: number; // số thứ tự đơn trong từng tenant
  @Column({ type: 'varchar', default: 'open' }) status: OrderStatus;
  @Column({ type: 'integer' }) subtotalVnd: number;
  @Column({ type: 'integer', default: 0 }) discountVnd: number;
  @Column({ type: 'integer', default: 0 }) taxVnd: number;
  @Column({ type: 'integer' }) totalVnd: number;
  @Column({ type: 'integer', default: 0 }) taxRatePercent: number;
  @Column({ type: 'varchar', default: 'inclusive' }) taxMode: TaxMode;
  @Column({ type: 'varchar', nullable: true }) discountType: 'percent' | 'amount' | null;
  @Column({ type: 'integer', nullable: true }) discountValue: number | null;
  @Column({ type: 'integer', default: 0 }) changeVnd: number;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @Column({ type: 'varchar', nullable: true }) customerId: string | null;
  @Column({ type: 'integer', default: 0 }) refundedVnd: number;
  @Column({ type: 'varchar', nullable: true }) paidKey: string | null; // idempotency key của lần thanh toán
  @Column() createdBy: string;
  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'datetime', nullable: true }) paidAt: Date | null;
}

@Entity('order_lines')
export class OrderLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() orderId: string;
  @Column() productId: string;
  @Column({ type: 'varchar', nullable: true }) variantId: string | null;
  @Column() name: string; // chụp lại tên và giá tại thời điểm bán
  @Column({ type: 'integer' }) unitPriceVnd: number;
  @Column({ type: 'integer' }) qty: number;
  @Column({ type: 'integer', default: 0 }) refundedQty: number;
  @Column({ type: 'integer' }) lineTotalVnd: number;
}

/** Hoàn tiền đơn đã thu. Không xóa đơn, không đổi trạng thái paid. */
@Entity('refunds')
@Unique(['tenantId', 'idempotencyKey'])
export class Refund {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() orderId: string;
  @Column({ type: 'integer' }) amountVnd: number;
  @Column({ type: 'varchar', nullable: true }) reason: string | null;
  @Column() idempotencyKey: string;
  @Column() createdBy: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('refund_lines')
export class RefundLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() refundId: string;
  @Column() orderLineId: string;
  @Column({ type: 'integer' }) qty: number;
  @Column({ type: 'integer' }) amountVnd: number;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() orderId: string;
  @Column({ type: 'varchar' }) method: 'cash' | 'transfer';
  @Column({ type: 'integer' }) amountVnd: number;
  @CreateDateColumn() createdAt: Date;
}
