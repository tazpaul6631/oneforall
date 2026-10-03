import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';

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

@Entity('modifier_groups')
export class ModifierGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Column({ default: false }) required: boolean;
  @Column({ type: 'integer', default: 0 }) minSelect: number;
  @Column({ type: 'integer', default: 1 }) maxSelect: number;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
}

@Entity('modifier_options')
export class ModifierOption {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() groupId: string;
  @Column() name: string;
  @Column({ type: 'integer' }) extraVnd: number;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
}

@Entity('product_modifier_groups')
@Unique(['tenantId', 'productId', 'groupId'])
export class ProductModifierGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @Column() groupId: string;
}
