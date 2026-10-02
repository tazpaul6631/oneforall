import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export interface TenantSettings {
  primaryColor: string;
  locale: string;
  currency: string;
  taxRatePercent: number; // 0-100
  taxMode: 'inclusive' | 'exclusive'; // giá đã gồm thuế hay chưa
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() preset: string;
  @Column({ type: 'simple-json' }) settings: TenantSettings;
  @Column({ default: 'pending' }) status: 'pending' | 'active' | 'suspended';
  @Column({ type: 'datetime', nullable: true }) activeUntil: Date | null;
  @CreateDateColumn() createdAt: Date;
}

@Entity('tenant_features')
@Unique(['tenantId', 'featureKey'])
export class TenantFeature {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() featureKey: string;
}
