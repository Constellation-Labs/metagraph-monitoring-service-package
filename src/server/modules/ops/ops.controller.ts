import { randomUUID } from 'crypto';

import { Controller, Post, Param, Body } from '@nestjs/common';

import {
  RestartRequestDto,
  RestartNodeRequestDto,
  ToggleMonitoringDto,
  OperationResultDto,
} from '../../../shared/dto/ops.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('api/metagraphs/:metagraph/ops')
export class OpsController {
  constructor(private monitoringService: MonitoringService) {}

  @Post('run-check')
  async runCheck(
    @Param('metagraph') metagraph: string,
  ): Promise<OperationResultDto> {
    const operationId = randomUUID();
    const startedAt = new Date().toISOString();

    try {
      await this.monitoringService.forceCheck(metagraph);
      return {
        operationId,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: 'Health check completed',
      };
    } catch (e: any) {
      return {
        operationId,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: e.message,
      };
    }
  }

  @Post('restart')
  async restart(
    @Param('metagraph') metagraph: string,
    @Body() dto: RestartRequestDto,
  ): Promise<OperationResultDto> {
    const operationId = randomUUID();
    const startedAt = new Date().toISOString();

    try {
      await this.monitoringService.forceRestart(metagraph);
      return {
        operationId,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: `Full metagraph restart completed${dto.reason ? `: ${dto.reason}` : ''}`,
      };
    } catch (e: any) {
      return {
        operationId,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: e.message,
      };
    }
  }

  @Post('restart-node')
  async restartNode(
    @Param('metagraph') metagraph: string,
    @Body() dto: RestartNodeRequestDto,
  ): Promise<OperationResultDto> {
    const operationId = randomUUID();
    const startedAt = new Date().toISOString();

    try {
      await this.monitoringService.restartNode(
        metagraph,
        dto.nodeIndex,
        dto.layers,
      );
      return {
        operationId,
        status: 'completed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: `Node ${dto.nodeIndex} restart completed for layers: ${dto.layers.join(', ')}`,
      };
    } catch (e: any) {
      return {
        operationId,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        message: e.message,
      };
    }
  }

  @Post('monitoring/toggle')
  toggleMonitoring(
    @Param('metagraph') metagraph: string,
    @Body() dto: ToggleMonitoringDto,
  ) {
    return this.monitoringService.toggleMonitoring(metagraph, dto.enabled);
  }
}
