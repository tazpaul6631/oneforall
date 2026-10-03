import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { CreateCategoryDto, CreateProductDto, ModifierGroupDto, UpdateCategoryDto, UpdateProductDto } from './product.dto';
import { ProductService } from './product.service';

@Controller()
@RequireFeature('core.product')
export class ProductController {
  constructor(private readonly svc: ProductService) {}

  @Get('categories') categories() { return this.svc.listCategories(); }

  @Post('categories')
  createCategory(@CurrentUser() u: AuthUser, @Body() dto: CreateCategoryDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.deleteCategory(id);
  }

  @Get('products')
  list(@Query('includeInactive') inc?: string) { return this.svc.list(inc === 'true'); }

  @Post('products')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateProductDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.create(dto);
  }

  @Patch('products/:id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.update(id, dto);
  }

  @Delete('products/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.delete(id);
  }

  @Get('modifier-groups') groups() { return this.svc.listGroups(); }

  @Post('modifier-groups')
  createGroup(@CurrentUser() u: AuthUser, @Body() dto: ModifierGroupDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createGroup(dto);
  }

  @Patch('modifier-groups/:id')
  updateGroup(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ModifierGroupDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.updateGroup(id, dto);
  }

  @Delete('modifier-groups/:id')
  deleteGroup(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    assertRole(u, 'owner', 'manager');
    return this.svc.deleteGroup(id);
  }
}
