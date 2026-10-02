import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly cls: ClsService,
  ) {}

  write(entry: {
    tenantId?: string;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    detail?: unknown;
  }) {
    const tenantId = entry.tenantId ?? this.cls.get('tenantId');
    const actorId = entry.actorId !== undefined ? entry.actorId : (this.cls.get('userId') ?? null);
    return this.repo.save(this.repo.create({
      tenantId,
      actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      detail: entry.detail === undefined ? null : JSON.stringify(entry.detail),
    }));
  }

  async list() {
    const tenantId = this.cls.get('tenantId');
    const rows = await this.repo.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 100 });
    return rows.map((r) => ({
      ...r,
      detail: r.detail ? safeParse(r.detail) : null,
    }));
  }
}

function safeParse(raw: string) {
  try { return JSON.parse(raw); } catch { return raw; }
}
