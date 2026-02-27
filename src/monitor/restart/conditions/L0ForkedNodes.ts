import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { restartLayerNodes } from '../utils/restart-layer-nodes';

export default class L0ForkedNodes implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'L0 Forked Nodes';

  private metagraphL0ForkedNodes: ISshService[] = [];

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
    const metagraphNodes = this.monitoringConfiguration.sshServices.map(
      (it) => it.metagraphNode,
    );

    this.logger.info('[ML0] Checking if nodes are forked');
    const forkedNodes =
      await this.monitoringConfiguration.metagraphService.getL0ForkedNodes(
        metagraphNodes,
      );

    if (forkedNodes.length === 0) {
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
