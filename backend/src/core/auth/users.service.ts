import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { ClsService } from 'nestjs-cls';
import { Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './auth.dto';
import { Operator } from './operator.entity';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  private readonly scoped: TenantRepository<User>;

  constructor(
    @InjectRepository(User) private readonly raw: Repository<User>,
    @InjectRepository(Operator) private readonly operators: Repository<Operator>,
    cls: ClsService,
    private readonly audit: AuditService,
  ) {
    this.scoped = new TenantRepository(raw, cls);
  }

  list() {
    return this.scoped.find({}, { order: { createdAt: 'ASC' } });
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.raw.exist({ where: { email } }) || await this.operators.exist({ where: { email } })) {
      throw new ConflictException('Email này đã được dùng');
    }
    const u = await this.scoped.save({
      email,
      fullName: dto.fullName.trim(),
      role: dto.role,
      passwordHash: await bcrypt.hash(dto.password, 10),
    });
    const { passwordHash, ...safe } = u;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    if (dto.active === undefined && dto.role === undefined) throw new BadRequestException('Không có gì để cập nhật');
    const current = await this.scoped.findOne({ id });
    if (!current) throw new NotFoundException('Không tìm thấy nhân viên');
    if (current.role === 'owner') throw new ForbiddenException('Không đổi được tài khoản chủ cửa hàng');
    if (dto.active === false && current.id === actor.userId) throw new BadRequestException('Không thể khóa chính tài khoản đang dùng');
    const patch: Partial<User> = {};
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.active !== undefined) patch.active = dto.active;
    const res = await this.raw.update({ id, tenantId: this.scoped.tenantId }, patch);
    if (!res.affected) throw new NotFoundException('Không tìm thấy nhân viên');
    await this.audit.write({ action: 'user.updated', entityType: 'user', entityId: id, detail: patch });
    const u = await this.scoped.findOne({ id });
    if (!u) throw new NotFoundException('Không tìm thấy nhân viên');
    const { passwordHash, ...safe } = u as User & { passwordHash?: string };
    return safe;
  }
}
