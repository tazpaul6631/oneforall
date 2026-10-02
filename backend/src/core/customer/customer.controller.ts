import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RequireFeature } from '../../platform/access/decorators';
import { CustomerDto, UpdateCustomerDto } from './customer.dto';
import { CustomerService } from './customer.service';

@Controller('customers')
@RequireFeature('core.customer')
export class CustomerController {
  constructor(private readonly svc: CustomerService) {}

  @Get() list(@Query('q') q?: string) { return this.svc.list(q); }
  @Post() create(@Body() dto: CustomerDto) { return this.svc.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.svc.update(id, dto); }
}
