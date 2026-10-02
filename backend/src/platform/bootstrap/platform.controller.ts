import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AuthUser, assertRole } from '../access/auth-user';
import { CurrentUser, Public } from '../access/decorators';
import { EntitlementService } from '../entitlement/entitlement.service';
import { ManifestRegistry } from '../manifest/manifest-registry.service';
import { UpdateSettingsDto } from '../tenant/settings.dto';
import { TenantService } from '../tenant/tenant.service';

@Controller()
export class PlatformController {
  constructor(
    private readonly registry: ManifestRegistry,
    private readonly tenants: TenantService,
    private readonly entitlement: EntitlementService,
  ) {}

  /** Danh sách mô hình kinh doanh để chọn khi tạo cửa hàng. */
  @Public()
  @Get('platform/presets')
  presets() {
    return this.registry.presets();
  }

  /** Frontend gọi 1 lần sau đăng nhập; toàn bộ UI dựa vào dữ liệu này. */
  @Get('me/bootstrap')
  async bootstrap(@CurrentUser() u: AuthUser) {
    const tenant = await this.tenants.getOrFail(u.tenantId);
    const features = [...(await this.entitlement.featuresOf(u.tenantId))].sort();
    return {
      user: { id: u.userId, name: u.name, email: u.email, role: u.role },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        preset: tenant.preset,
        presetLabel: this.registry.presetLabel(tenant.preset),
      },
      features,
      menu: this.registry.menuFor(features),
      settings: { taxRatePercent: tenant.settings.taxRatePercent, taxMode: tenant.settings.taxMode },
      theme: { primary: tenant.settings.primaryColor },
      locale: tenant.settings.locale,
    };
  }

  @Patch('platform/settings')
  updateSettings(@CurrentUser() u: AuthUser, @Body() dto: UpdateSettingsDto) {
    assertRole(u, 'owner');
    return this.tenants.updateSettings(u.tenantId, dto);
  }
}
