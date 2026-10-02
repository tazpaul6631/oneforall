import { ConflictException, ForbiddenException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { TenantService } from '../../platform/tenant/tenant.service';
import { LoginDto, RegisterTenantDto } from './auth.dto';
import { Operator } from './operator.entity';
import { User } from './user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Operator) private readonly operators: Repository<Operator>,
    private readonly dataSource: DataSource,
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    const email = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
    const password = process.env.OPERATOR_PASSWORD;
    if (!email || !password || password.length < 8) return;
    if (await this.users.exist({ where: { email } }) || await this.operators.exist({ where: { email } })) return;
    await this.operators.save(
      this.operators.create({
        email,
        fullName: 'Vận hành',
        active: true,
        passwordHash: await bcrypt.hash(password, 10),
      }),
    );
  }

  private sign(u: { id: string; tenantId: string | null; role: User['role']; fullName: string; email: string }) {
    return {
      accessToken: this.jwt.sign({
        sub: u.id,
        tenantId: u.tenantId,
        role: u.role,
        name: u.fullName,
        email: u.email,
      }),
      role: u.role,
    };
  }

  async registerTenant(dto: RegisterTenantDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exist({ where: { email } }) || await this.operators.exist({ where: { email } })) {
      throw new ConflictException('Email này đã được dùng');
    }
    await this.dataSource.transaction(async (m) => {
      const tenant = await this.tenants.provision(m, dto.tenantName.trim(), dto.preset);
      await m.save(
        m.create(User, {
          tenantId: tenant.id,
          email,
          fullName: dto.fullName.trim(),
          role: 'owner',
          passwordHash: await bcrypt.hash(dto.password, 10),
        }),
      );
    });
    return { status: 'pending' as const };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
    if (user) {
      const ok = user.active && (await bcrypt.compare(dto.password, user.passwordHash));
      if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
      const reason = await this.tenants.blockReason(user.tenantId);
      if (reason) throw new ForbiddenException(reason);
      return this.sign(user);
    }
    const op = await this.operators
      .createQueryBuilder('o')
      .addSelect('o.passwordHash')
      .where('o.email = :email', { email })
      .getOne();
    const ok = op && op.active && (await bcrypt.compare(dto.password, op.passwordHash));
    if (!ok || !op) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    return this.sign({ ...op, tenantId: null, role: 'operator' });
  }
}
