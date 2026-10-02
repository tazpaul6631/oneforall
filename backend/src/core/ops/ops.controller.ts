import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, OpsOnly } from '../../platform/access/decorators';
import { ActivateTenantDto, ResetOwnerPasswordDto } from './ops.dto';
import { OpsService } from './ops.service';

@Controller('ops')
@OpsOnly()
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    assertRole(u, 'operator');
    return { role: u.role, name: u.name, email: u.email };
  }

  @Get('tenants')
  list(@CurrentUser() u: AuthUser) {
    assertRole(u, 'operator');
    return this.ops.list();
  }

  @Post('tenants/:id/activate')
  activate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ActivateTenantDto) {
    assertRole(u, 'operator');
    return this.ops.activate(id, dto?.days ?? 30);
  }

  @Post('tenants/:id/suspend')
  suspend(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'operator');
    return this.ops.suspend(id);
  }

  @Post('tenants/:id/reset-password')
  resetPassword(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ResetOwnerPasswordDto) {
    assertRole(u, 'operator');
    return this.ops.resetOwnerPassword(id, dto.password);
  }
}
