import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { CreateReturnDto } from './retail.dto';
import { RetailService } from './retail.service';

@Controller('retail')
export class RetailController {
  constructor(private readonly svc: RetailService) {}

  @Get('lookup') @RequireFeature('retail.barcode')
  lookup(@Query('code') code = '') { return this.svc.lookup(code); }

  @Get('returns') @RequireFeature('retail.return')
  returns() { return this.svc.list(); }

  @Post('returns') @RequireFeature('retail.return')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateReturnDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.create(dto, u);
  }
}
