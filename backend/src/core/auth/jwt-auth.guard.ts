import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { IS_PUBLIC, OPS_ONLY } from '../../platform/access/decorators';
import { TenantService } from '../../platform/tenant/tenant.service';

/** Guard toàn cục: route nào không gắn @Public() đều bắt buộc JWT, và nạp tenant vào request context. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
    private readonly tenants: TenantService,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const ok = (await super.canActivate(ctx)) as boolean;
    const user = ctx.switchToHttp().getRequest().user;
    const opsOnly = this.reflector.getAllAndOverride<boolean>(OPS_ONLY, [ctx.getHandler(), ctx.getClass()]);
    if (user.role === 'operator') {
      if (!opsOnly) throw new ForbiddenException('Tài khoản vận hành không dùng màn hình cửa hàng');
      return ok;
    }
    if (opsOnly) throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    const reason = await this.tenants.blockReason(user.tenantId);
    if (reason) throw new ForbiddenException(reason);
    this.cls.set('tenantId', user.tenantId);
    this.cls.set('userId', user.userId);
    return ok;
  }
}
