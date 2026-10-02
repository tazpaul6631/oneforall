import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ManifestRegistry } from '../manifest/manifest-registry.service';
import { TenantFeature } from '../tenant/tenant.entity';

const TTL_MS = 30_000;

@Injectable()
export class EntitlementService {
  private cache = new Map<string, { at: number; set: Set<string> }>();

  constructor(
    @InjectRepository(TenantFeature) private readonly repo: Repository<TenantFeature>,
    private readonly registry: ManifestRegistry,
  ) {}

  async featuresOf(tenantId: string): Promise<Set<string>> {
    const hit = this.cache.get(tenantId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.set;
    const rows = await this.repo.find({ where: { tenantId } });
    const set = new Set(rows.map((r) => r.featureKey));
    // Feature luôn bật (ví dụ tồn kho thêm sau) phải có mặt cả với tenant đã tạo từ trước.
    for (const key of this.registry.alwaysOn()) set.add(key);
    this.cache.set(tenantId, { at: Date.now(), set });
    return set;
  }

  async has(tenantId: string, feature: string) {
    return (await this.featuresOf(tenantId)).has(feature);
  }

  /** Thay toàn bộ feature của tenant (dùng khi đổi gói). */
  async setFeatures(tenantId: string, features: string[]) {
    await this.repo.delete({ tenantId });
    await this.repo.save(features.map((featureKey) => this.repo.create({ tenantId, featureKey })));
    this.cache.delete(tenantId);
  }
}
