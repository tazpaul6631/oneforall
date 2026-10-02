import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderLine } from '../../core/order/order.entity';
import { CoreModule } from '../../core/core.module';
import { ManifestRegistry } from '../../platform/manifest/manifest-registry.service';
import { FnbController } from './fnb.controller';
import { FnbArea, FnbRecipe, FnbRecipeItem, FnbTable, FnbTicket, FnbTicketLine } from './fnb.entity';
import { FnbListener } from './fnb.listener';
import { fnbManifest } from './fnb.manifest';
import { FnbService } from './fnb.service';

@Module({
  imports: [
    CoreModule,
    TypeOrmModule.forFeature([FnbArea, FnbTable, FnbTicket, FnbTicketLine, FnbRecipe, FnbRecipeItem, Order, OrderLine]),
  ],
  controllers: [FnbController],
  providers: [FnbService, FnbListener],
  exports: [FnbService],
})
export class FnbModule {
  constructor(registry: ManifestRegistry) {
    registry.register(fnbManifest);
  }
}
