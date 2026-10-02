import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthUser } from '../../platform/access/auth-user';
import { jwtSecret } from './jwt';
import { Operator } from './operator.entity';
import { User } from './user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Operator) private readonly operators: Repository<Operator>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret(),
    });
  }

  async validate(p: { sub: string; role: AuthUser['role'] }): Promise<AuthUser> {
    if (p.role === 'operator') {
      const op = await this.operators.findOne({ where: { id: p.sub } });
      if (!op?.active) throw new UnauthorizedException('Tài khoản đã bị khóa');
      return { userId: op.id, tenantId: '', role: 'operator', name: op.fullName, email: op.email };
    }
    const row = await this.users.findOne({ where: { id: p.sub } });
    if (!row?.active) throw new UnauthorizedException('Tài khoản đã bị khóa');
    return { userId: row.id, tenantId: row.tenantId, role: row.role, name: row.fullName, email: row.email };
  }
}
