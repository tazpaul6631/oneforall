import { Controller, Get } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser } from '../../platform/access/decorators';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    assertRole(u, 'owner', 'manager');
    return this.svc.list();
  }
}
