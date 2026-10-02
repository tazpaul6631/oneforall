import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { ReceiveStockDto } from './stock.dto';
import { StockService } from './stock.service';

@Controller('inventory')
@RequireFeature('core.inventory')
export class StockController {
  constructor(private readonly svc: StockService) {}

  @Get() overview() { return this.svc.overview(); }

  @Post('receive')
  receive(@CurrentUser() u: AuthUser, @Body() dto: ReceiveStockDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.receive(dto);
  }
}
