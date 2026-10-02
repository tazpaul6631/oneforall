import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, Public } from '../../platform/access/decorators';
import { CreateUserDto, LoginDto, RegisterTenantDto, UpdateUserDto } from './auth.dto';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public() @Post('auth/register-tenant')
  register(@Body() dto: RegisterTenantDto) {
    return this.auth.registerTenant(dto);
  }

  @Public() @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('users')
  list(@CurrentUser() u: AuthUser) {
    assertRole(u, 'owner', 'manager');
    return this.users.list();
  }

  @Post('users')
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateUserDto) {
    assertRole(u, 'owner');
    return this.users.create(dto);
  }

  @Patch('users/:id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    assertRole(u, 'owner');
    return this.users.update(id, dto, u);
  }
}
