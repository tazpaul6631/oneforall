import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column({ type: 'varchar', nullable: true }) categoryId: string | null;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ type: 'integer' }) priceVnd: number; // số nguyên VND
  @Column({ default: true }) active: boolean;
  @OneToMany(() => ProductVariant, (v) => v.product) variants: ProductVariant[];
  @CreateDateColumn() createdAt: Date;
}

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ type: 'integer' }) priceVnd: number; // giá bán đầy đủ của variant
}
