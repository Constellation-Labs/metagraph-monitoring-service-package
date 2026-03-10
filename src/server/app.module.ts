import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { MonitoringConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { LogsModule } from './modules/logs/logs.module';
import { MetagraphsModule } from './modules/metagraphs/metagraphs.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { OpsModule } from './modules/ops/ops.module';
import { StatusModule } from './modules/status/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    AuthModule,
    MonitoringModule,
    HealthModule,
    MetagraphsModule,
    StatusModule,
    NodesModule,
    OpsModule,
    LogsModule,
    MonitoringConfigModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
