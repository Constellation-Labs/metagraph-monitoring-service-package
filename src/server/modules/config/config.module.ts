import { Module } from '@nestjs/common';

import { MonitoringConfigController } from './config.controller';

@Module({
  controllers: [MonitoringConfigController],
})
export class MonitoringConfigModule {}
