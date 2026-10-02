import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderLine } from '../../core/order/order.entity';
import { CoreModule } from '../../core/core.module';
import { ManifestRegistry } from '../../platform/manifest/manifest-registry.service';
import { CinemaController } from './cinema.controller';
import { CinemaMovie, CinemaRoom, CinemaSale, CinemaSeat, CinemaShowtime, CinemaTicket } from './cinema.entity';
import { CinemaListener } from './cinema.listener';
import { cinemaManifest } from './cinema.manifest';
import { CinemaService } from './cinema.service';

@Module({
  imports: [
    CoreModule,
    TypeOrmModule.forFeature([CinemaMovie, CinemaRoom, CinemaSeat, CinemaShowtime, CinemaTicket, CinemaSale, OrderLine]),
  ],
  controllers: [CinemaController],
  providers: [CinemaService, CinemaListener],
  exports: [CinemaService],
})
export class CinemaModule {
  constructor(registry: ManifestRegistry) {
    registry.register(cinemaManifest);
  }
}
