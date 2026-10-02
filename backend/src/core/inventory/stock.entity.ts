import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stock_levels')
export class StockLevel {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @Column({ type: 'varchar', nullable: true }) variantId: string | null;
  @Column({ type: 'integer', default: 0 }) qty: number;
}

@Entity('stock_moves')
export class StockMove {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @Column({ type: 'varchar', nullable: true }) variantId: string | null;
  @Column({ type: 'integer' }) delta: number;
  @Column() reason: string;
  @Column() refType: string;
  @Column() refId: string;
  @Column({ type: 'varchar', nullable: true }) note: string | null;
  @CreateDateColumn() createdAt: Date;
}
