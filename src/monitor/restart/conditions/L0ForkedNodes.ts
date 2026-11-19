import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { FullMetagraph } from '../groups/FullMetagraph';
import { restartLayerNodes } from '../utils/restart-layer-nodes';

export const DEFAULT_MAX_INDIVIDUAL_FORK_RESTARTS = 3;

export default class L0ForkedNodes implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'L0 Forked Nodes';

  private metagraphL0ForkedNodes: ISshService[] = [];
  private escalateToFullMetagraph = false;

  // Consecutive checks each node has been found forked. The condition object
  // lives for the whole monitor process, so this survives between checks.
  private consecutiveForks = new Map<string, number>();

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'L0ForkedNodes',
    );
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.logger.info('Checking for forked ML0 nodes');
    this.metagraphL0ForkedNodes = [];
    this.escalateToFullMetagraph = false;
    const metagraphNodes = this.monitoringConfiguration.sshServices.map(
      (it) => it.metagraphNode,
    );

    this.logger.info('[ML0] Checking if nodes are forked');
    const forkedNodes =
      await this.monitoringConfiguration.metagraphService.getL0ForkedNodes(
        metagraphNodes,
      );

    if (forkedNodes.length === 0) {
      this.consecutiveForks.clear();
      return {
        shouldRestart: false,
        restartType: '',
      };
    }

    const forkedNodesIps = forkedNodes.map((it) => it.ip);

    this.metagraphL0ForkedNodes =
      this.monitoringConfiguration.sshServices.filter((it) =>
        forkedNodesIps.includes(it.metagraphNode.ip),
      );

    const counts = new Map<string, number>();
    for (const ip of forkedNodesIps) {
      counts.set(ip, (this.consecutiveForks.get(ip) ?? 0) + 1);
    }
    this.consecutiveForks = counts;

    const maxRestarts =
      this.monitoringConfiguration.config.max_individual_fork_restarts ??
      DEFAULT_MAX_INDIVIDUAL_FORK_RESTARTS;
    const stuck = [...counts.entries()].filter(
      ([, count]) => maxRestarts > 0 && count > maxRestarts,
    );
    if (stuck.length > 0) {
      this.escalateToFullMetagraph = true;
      const stuckIps = stuck.map(([ip]) => ip).join(', ');
      this.logger.warn(
        `[ml0] Node(s) [${stuckIps}] still forked after ${maxRestarts} individual restarts, escalating to full metagraph restart`,
      );
      return {
        shouldRestart: true,
        restartType: `Full metagraph: ML0 still forked after ${maxRestarts} individual restarts: [${stuckIps}]`,
      };
    }

    const forkedIps = this.metagraphL0ForkedNodes
      .map((it) => it.metagraphNode.ip)
      .join(', ');
    const restartType = `Individual nodes — ML0 forked: [${forkedIps}]`;
    return {
      shouldRestart: true,
      restartType,
    };
  }

  async triggerRestart(): Promise<void> {
    if (this.escalateToFullMetagraph) {
      this.escalateToFullMetagraph = false;
      this.consecutiveForks.clear();
      await new FullMetagraph(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
      ).performRestart();
      return;
    }

    if (this.metagraphL0ForkedNodes.length > 0) {
      await restartLayerNodes(
        this.monitoringConfiguration,
        this.metagraphL0ForkedNodes,
        Layers.ML0,
        this.logger,
      );
    }
  }
}
