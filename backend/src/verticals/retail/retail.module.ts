import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoreModule } from '../../core/core.module';
import { ManifestRegistry } from '../../platform/manifest/manifest-registry.service';
import { RetailController } from './retail.controller';
import { RetailReturn, RetailReturnLine } from './retail.entity';
import { retailManifest } from './retail.manifest';
import { RetailService } from './retail.service';

@Module({
  imports: [CoreModule, TypeOrmModule.forFeature([RetailReturn, RetailReturnLine])],
  controllers: [RetailController],
  providers: [RetailService],
  exports: [RetailService],
})
export class RetailModule {
  constructor(registry: ManifestRegistry) {
    registry.register(retailManifest);
  }
}
