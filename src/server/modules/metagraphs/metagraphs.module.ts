import { Module } from '@nestjs/common';

import { MetagraphsController } from './metagraphs.controller';

@Module({
  controllers: [MetagraphsController],
})
export class MetagraphsModule {}
