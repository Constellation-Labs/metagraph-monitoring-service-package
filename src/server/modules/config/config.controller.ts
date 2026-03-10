import { Controller, Get, Param } from '@nestjs/common';

import { ConfigSummaryDto } from '../../../shared/dto/config.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('api/metagraphs/:metagraph')
export class MonitoringConfigController {
  constructor(private monitoringService: MonitoringService) {}

  @Get('config')
  getConfig(@Param('metagraph') metagraph: string): ConfigSummaryDto {
    const config = this.monitoringService.getConfig(metagraph);
    if (!config) return {} as ConfigSummaryDto;

    return {
      metagraphId: config.metagraph.id,
      metagraphName: config.metagraph.name,
      metagraphVersion: config.metagraph.version,
      networkName: config.network.name,
      checkIntervalMinutes: config.check_healthy_interval_in_minutes,
      restartConditions: config.metagraph.default_restart_conditions,
      alertConditions: config.metagraph.default_alert_conditions ?? [],
      nodeCount: config.metagraph.nodes.length,
      layers: {
        ml0: {
          enabled: !config.metagraph.layers.ml0.ignore_layer,
          ports: config.metagraph.layers.ml0.ports,
        },
        cl1: {
          enabled: !config.metagraph.layers.cl1.ignore_layer,
          ports: config.metagraph.layers.cl1.ports,
        },
        dl1: {
          enabled: !config.metagraph.layers.dl1.ignore_layer,
          ports: config.metagraph.layers.dl1.ports,
        },
      },
    };
  }
}
