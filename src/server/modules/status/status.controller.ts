import { Controller, Get, Param } from '@nestjs/common';

import { MetagraphStatusDto } from '../../../shared/dto/status.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('api/metagraphs/:metagraph')
export class StatusController {
  constructor(private monitoringService: MonitoringService) {}

  @Get('status')
  getStatus(@Param('metagraph') metagraph: string): MetagraphStatusDto {
    const state = this.monitoringService.getState(metagraph);
    if (!state) {
      return {} as MetagraphStatusDto;
    }

    const healthyNodes = state.nodes.filter(
      (n) =>
        n.ml0Health === 'healthy' &&
        (n.cl1Health === 'healthy' || n.cl1Health === 'unknown') &&
        (n.dl1Health === 'healthy' || n.dl1Health === 'unknown'),
    ).length;

    const uptimeSeconds = Math.floor(
      (Date.now() - new Date(state.startedAt).getTime()) / 1000,
    );

    return {
      metagraphId: state.metagraphId,
      metagraphName: state.metagraphName,
      overallHealth: state.overallHealth,
      lastPollTime: state.lastPollTime,
      nextPollTime: state.nextPollTime,
      lastSnapshotOrdinal: state.lastSnapshotOrdinal,
      lastSnapshotHash: state.lastSnapshotHash,
      ownerAddress: state.ownerAddress,
      activeAlerts: state.activeAlerts,
      nodeCount: state.nodes.length,
      healthyNodeCount: healthyNodes,
      monitoringLoopRunning: state.loopRunning,
      uptimeSeconds,
      pollCount: state.pollCount,
      restartCount: state.restartCount,
    };
  }
}
