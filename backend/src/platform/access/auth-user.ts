import { ForbiddenException } from '@nestjs/common';

export type Role = 'owner' | 'manager' | 'staff' | 'operator';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
  name: string;
  email: string;
}

export function assertRole(user: AuthUser, ...allowed: Role[]) {
  if (!allowed.includes(user.role)) {
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
  }
}
