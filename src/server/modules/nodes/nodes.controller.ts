import { Controller, Get, Param, NotFoundException } from '@nestjs/common';

import { NodeSummaryDto, NodeDetailDto } from '../../../shared/dto/node.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('api/metagraphs/:metagraph')
export class NodesController {
  constructor(private monitoringService: MonitoringService) {}

  @Get('nodes')
  getNodes(@Param('metagraph') metagraph: string): NodeSummaryDto[] {
    const state = this.monitoringService.getState(metagraph);
    if (!state) return [];

    return state.nodes.map((node, index) => ({
      index,
      ip: node.ip,
      ml0Status: node.ml0Health,
      cl1Status: node.cl1Health,
      dl1Status: node.dl1Health,
    }));
  }

  @Get('nodes/:id')
  getNode(
    @Param('metagraph') metagraph: string,
    @Param('id') id: string,
  ): NodeDetailDto {
    const state = this.monitoringService.getState(metagraph);
    if (!state) throw new NotFoundException('Metagraph not found');

    const index = parseInt(id, 10);
    const node = state.nodes[index];
    if (!node) throw new NotFoundException(`Node ${id} not found`);

    return {
      index,
      ip: node.ip,
      ml0Status: node.ml0Health,
      cl1Status: node.cl1Health,
      dl1Status: node.dl1Health,
      instanceId: node.instanceId,
      ml0Port: node.ml0Port,
      cl1Port: node.cl1Port,
      dl1Port: node.dl1Port,
      sshUsername: node.sshUsername,
    };
  }
}
