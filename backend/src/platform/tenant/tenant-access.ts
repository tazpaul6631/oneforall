export type TenantStatus = 'pending' | 'active' | 'suspended';
export type TenantAccess = TenantStatus | 'expired';

/** Hết hạn là trạng thái tính từ ngày, không cần job nền. */
export function tenantAccess(
  status: string,
  activeUntil: Date | string | null | undefined,
  now = new Date(),
): TenantAccess {
  if (status === 'suspended') return 'suspended';
  if (status === 'pending') return 'pending';
  if (activeUntil) {
    const end = new Date(activeUntil).getTime();
    if (!Number.isNaN(end) && end < now.getTime()) return 'expired';
  }
  return 'active';
}

export function blockMessage(access: TenantAccess): string | null {
  if (access === 'pending') return 'Cửa hàng đang chờ kích hoạt';
  if (access === 'suspended') return 'Cửa hàng đang bị tạm khóa';
  if (access === 'expired') return 'Gói sử dụng đã hết hạn';
  return null;
}
