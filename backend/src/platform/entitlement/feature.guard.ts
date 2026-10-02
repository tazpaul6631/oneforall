import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../access/decorators';
import { EntitlementService } from './entitlement.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlement: EntitlementService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const need = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!need) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user || !(await this.entitlement.has(user.tenantId, need))) {
      throw new ForbiddenException(`Gói hiện tại chưa bật tính năng "${need}"`);
    }
    return true;
  }
}
