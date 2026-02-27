import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { IndividualNode } from '../groups/IndividualNode';

export async function restartLayerNodes(
  monitoringConfiguration: MonitoringConfiguration,
  unhealthyNodes: ISshService[],
  layer: AvailableLayers,
  logger: Logger,
): Promise<void> {
  const unhealthyIps = unhealthyNodes.map((n) => n.metagraphNode.ip);

  logger.info(`[${layer}] Resolving healthy reference node`);
  const referenceNode = monitoringConfiguration.sshServices
    .map((s) => s.metagraphNode)
    .find((n) => !unhealthyIps.includes(n.ip));

  if (!referenceNode) {
    throw new Error(
      `[${layer}] No healthy reference node available for layer ${layer}`,
    );
  }

  logger.info(
    `[${layer}] Restarting ${unhealthyNodes.length} individual node(s)`,
  );
  for (const node of unhealthyNodes) {
    logger.info(
      `[${layer}] Restarting node ${node.metagraphNode.ip} (ref=${referenceNode.ip})`,
    );
    await new IndividualNode(
      monitoringConfiguration,
      node,
      referenceNode,
      monitoringConfiguration.globalNetworkService.referenceSourceNode,
      layer,
    ).performRestart();
  }
}
