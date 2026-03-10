import { Controller, Get } from '@nestjs/common';

import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('api/metagraphs')
export class MetagraphsController {
  constructor(private monitoringService: MonitoringService) {}

  @Get()
  getMetagraphs() {
    return this.monitoringService.getMetagraphsSummary();
  }
}
