import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ManifestRegistry } from '../manifest/manifest-registry.service';
import { blockMessage, tenantAccess } from './tenant-access';
import { Tenant, TenantFeature, TenantSettings } from './tenant.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly registry: ManifestRegistry,
  ) {}

  /** Tạo tenant + bật feature theo preset, chạy trong transaction do nơi gọi truyền vào. */
  async provision(m: EntityManager, name: string, presetKey: string): Promise<Tenant> {
    const preset = this.registry.resolvePreset(presetKey);
    if (!preset) throw new BadRequestException('Mô hình kinh doanh không hợp lệ');
    const tenant = await m.save(
      m.create(Tenant, {
        name,
        preset: presetKey,
        status: 'pending',
        activeUntil: null,
        settings: { primaryColor: preset.color, locale: 'vi-VN', currency: 'VND', taxRatePercent: 0, taxMode: 'inclusive' },
      }),
    );
    await m.save(
      preset.features.map((featureKey) => m.create(TenantFeature, { tenantId: tenant.id, featureKey })),
    );
    return tenant;
  }

  async getOrFail(id: string): Promise<Tenant> {
    const t = await this.tenants.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Không tìm thấy tenant');
    return t;
  }

  async updateSettings(id: string, patch: Partial<TenantSettings>): Promise<TenantSettings> {
    const t = await this.getOrFail(id);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    t.settings = { ...t.settings, ...clean };
    await this.tenants.save(t);
    return t.settings;
  }

  async listAll(): Promise<Tenant[]> {
    return this.tenants.find({ order: { createdAt: 'DESC' } });
  }

  async blockReason(id: string): Promise<string | null> {
    const t = await this.tenants.findOne({ where: { id } });
    if (!t) return 'Không tìm thấy cửa hàng';
    return blockMessage(tenantAccess(t.status, t.activeUntil));
  }

  /** Gia hạn từ ngày hết hạn hiện tại nếu gói vẫn còn. Cửa hàng chờ hoặc đã khóa thì tính từ hôm nay. */
  async grant(id: string, days: number): Promise<Tenant> {
    const t = await this.getOrFail(id);
    const now = new Date();
    const end = t.activeUntil ? new Date(t.activeUntil) : null;
    const base = t.status === 'active' && end && end.getTime() > now.getTime() ? end : now;
    t.status = 'active';
    t.activeUntil = new Date(base.getTime() + days * 86_400_000);
    return this.tenants.save(t);
  }

  async suspend(id: string): Promise<Tenant> {
    const t = await this.getOrFail(id);
    if (t.status === 'pending') throw new BadRequestException('Cửa hàng chưa kích hoạt');
    t.status = 'suspended';
    return this.tenants.save(t);
  }
}
