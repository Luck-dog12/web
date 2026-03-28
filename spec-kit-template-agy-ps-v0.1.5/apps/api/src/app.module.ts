import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { GeoModule } from './common/geo/geo.module';
import { MetricsModule } from './common/observability/metrics.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AdminContentModule } from './modules/admin-content/admin-content.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { EntitlementModule } from './modules/entitlement/entitlement.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PlaybackModule } from './modules/playback/playback.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GeoModule,
    MetricsModule,
    PrismaModule,
    RedisModule,
    AdminContentModule,
    AuthModule,
    CatalogModule,
    PaymentModule,
    EntitlementModule,
    PlaybackModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
