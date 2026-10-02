import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('retail_returns')
@Unique(['tenantId', 'idempotencyKey'])
export class RetailReturn {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() orderId: string;
  @Column() refundId: string;
  @Column({ type: 'integer' }) totalVnd: number;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @Column() idempotencyKey: string;
  @Column() createdBy: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('retail_return_lines')
export class RetailReturnLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() returnId: string;
  @Column() orderLineId: string;
  @Column() name: string;
  @Column({ type: 'integer' }) qty: number;
  @Column({ type: 'integer' }) amountVnd: number;
}
