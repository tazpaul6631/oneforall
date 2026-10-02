import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformController } from './bootstrap/platform.controller';
import { EntitlementService } from './entitlement/entitlement.service';
import { FeatureGuard } from './entitlement/feature.guard';
import { ManifestRegistry } from './manifest/manifest-registry.service';
import { Tenant, TenantFeature } from './tenant/tenant.entity';
import { TenantService } from './tenant/tenant.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantFeature])],
  controllers: [PlatformController],
  providers: [ManifestRegistry, TenantService, EntitlementService, FeatureGuard],
  exports: [ManifestRegistry, TenantService, EntitlementService, FeatureGuard],
})
export class PlatformModule {}
