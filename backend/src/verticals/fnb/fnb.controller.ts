import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { AreaDto, AssignTableDto, RecipeDto, SplitBillDto, TableDto, TicketStatusDto, UpdateTableDto } from './fnb.dto';
import { MergeOrderDto } from '../../core/order/order.dto';
import { FnbService } from './fnb.service';

@Controller('fnb')
export class FnbController {
  constructor(private readonly svc: FnbService) {}

  @Get('tables') @RequireFeature('fnb.table_map')
  tables() { return this.svc.floor(); }

  @Post('areas') @RequireFeature('fnb.table_map')
  createArea(@CurrentUser() u: AuthUser, @Body() dto: AreaDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createArea(dto);
  }

  @Patch('areas/:id') @RequireFeature('fnb.table_map')
  updateArea(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AreaDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.updateArea(id, dto);
  }

  @Delete('areas/:id') @RequireFeature('fnb.table_map')
  deleteArea(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.deleteArea(id);
  }

  @Post('tables') @RequireFeature('fnb.table_map')
  createTable(@CurrentUser() u: AuthUser, @Body() dto: TableDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createTable(dto);
  }

  @Patch('tables/:id') @RequireFeature('fnb.table_map')
  updateTable(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateTableDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.updateTable(id, dto);
  }

  @Delete('tables/:id') @RequireFeature('fnb.table_map')
  deleteTable(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.deleteTable(id);
  }

  @Post('tables/:id/assign') @RequireFeature('fnb.table_map')
  assign(@Param('id') id: string, @Body() dto: AssignTableDto) { return this.svc.assign(id, dto); }

  @Post('tables/:id/clear') @RequireFeature('fnb.table_map')
  clear(@Param('id') id: string) { return this.svc.clear(id); }

  @Get('kds') @RequireFeature('fnb.kds')
  kds() { return this.svc.tickets(); }

  @Patch('kds/:id') @RequireFeature('fnb.kds')
  setTicket(@Param('id') id: string, @Body() dto: TicketStatusDto) { return this.svc.setTicketStatus(id, dto); }

  @Get('recipes') @RequireFeature('fnb.recipe')
  recipes() { return this.svc.listRecipes(); }

  @Post('recipes') @RequireFeature('fnb.recipe')
  saveRecipe(@CurrentUser() u: AuthUser, @Body() dto: RecipeDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.saveRecipe(dto);
  }

  @Delete('recipes/:id') @RequireFeature('fnb.recipe')
  deleteRecipe(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.deleteRecipe(id);
  }

  @Post('bills/split') @RequireFeature('fnb.split_bill')
  split(@CurrentUser() u: AuthUser, @Body() dto: SplitBillDto) {
    return this.svc.split(dto.orderId, dto, u);
  }

  @Post('bills/merge') @RequireFeature('fnb.split_bill')
  merge(@Body() dto: MergeOrderDto) { return this.svc.merge(dto); }
}
