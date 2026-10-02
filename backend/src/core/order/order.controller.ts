import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { CreateOrderDto, PayOrderDto, PreviewOrderDto, RefundDto } from './order.dto';
import { OrderService } from './order.service';

@Controller('orders')
@RequireFeature('core.order')
export class OrderController {
  constructor(private readonly svc: OrderService) {}

  @Post('preview') preview(@Body() dto: PreviewOrderDto) { return this.svc.preview(dto); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrderDto) { return this.svc.create(dto, u); }
  @Get('summary') summary() { return this.svc.summary(); }
  @Get() list(@Query('status') status?: string) { return this.svc.list(status); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Post(':id/pay') pay(@Param('id') id: string, @Body() dto: PayOrderDto) { return this.svc.pay(id, dto); }

  @Post(':id/void')
  void(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.void(id);
  }

  @Post(':id/refund')
  refund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RefundDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.refund(id, dto, u);
  }
}
