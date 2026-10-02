import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from './core/auth/jwt-auth.guard';
import { CoreModule } from './core/core.module';
import { FeatureGuard } from './platform/entitlement/feature.guard';
import { migrations } from './migrations';
import { PlatformModule } from './platform/platform.module';
import { CinemaModule } from './verticals/cinema/cinema.module';
import { FnbModule } from './verticals/fnb/fnb.module';
import { RetailModule } from './verticals/retail/retail.module';

const dbPath = process.env.DB_PATH ?? 'data/app.db';
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    EventEmitterModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: dbPath,
      autoLoadEntities: true,
      synchronize: false, // schema chỉ đổi qua migration
      migrations,
      migrationsRun: true,
      enableWAL: true,
    }),
    PlatformModule,
    CoreModule,
    FnbModule,
    RetailModule,
    CinemaModule,
  ],
  providers: [
    // Thứ tự quan trọng: đăng nhập trước, kiểm tra feature sau.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: FeatureGuard },
  ],
})
export class AppModule {}
