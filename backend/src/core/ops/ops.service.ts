import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { ManifestRegistry } from '../../platform/manifest/manifest-registry.service';
import { tenantAccess } from '../../platform/tenant/tenant-access';
import { TenantService } from '../../platform/tenant/tenant.service';
import { User } from '../auth/user.entity';

@Injectable()
export class OpsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly tenantService: TenantService,
    private readonly registry: ManifestRegistry,
  ) {}

  async list() {
    const tenants = await this.tenantService.listAll();
    const owners = await this.users.find({ where: { role: 'owner' } });
    const emailOf = new Map(owners.map((u) => [u.tenantId, u.email]));
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      preset: t.preset,
      presetLabel: this.registry.presetLabel(t.preset),
      status: tenantAccess(t.status, t.activeUntil),
      activeUntil: t.activeUntil,
      ownerEmail: emailOf.get(t.id) ?? '',
      createdAt: t.createdAt,
    }));
  }

  async activate(id: string, days = 30) {
    const t = await this.tenantService.grant(id, days);
    return { id: t.id, status: tenantAccess(t.status, t.activeUntil), activeUntil: t.activeUntil };
  }

  async suspend(id: string) {
    const t = await this.tenantService.suspend(id);
    return { id: t.id, status: tenantAccess(t.status, t.activeUntil), activeUntil: t.activeUntil };
  }

  async resetOwnerPassword(tenantId: string, password: string) {
    const owner = await this.users.findOne({ where: { tenantId, role: 'owner' } });
    if (!owner) throw new NotFoundException('Không tìm thấy chủ cửa hàng');
    await this.users.update({ id: owner.id }, { passwordHash: await bcrypt.hash(password, 10) });
    return { ok: true };
  }
}
