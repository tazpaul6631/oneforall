import { Cinema1791000000000 } from './1791000000000-Cinema';
import { ExtendSales1790910000000 } from './1790910000000-ExtendSales';
import { Init1790839127360 } from './1790839127360-Init';
import { Modifiers1791200000000 } from './1791200000000-Modifiers';
import { TenantBilling1791100000000 } from './1791100000000-TenantBilling';

// Thêm migration mới vào cuối mảng (sinh bằng `npm run migration:generate src/migrations/<Tên>`).
export const migrations = [Init1790839127360, ExtendSales1790910000000, Cinema1791000000000, TenantBilling1791100000000, Modifiers1791200000000];
