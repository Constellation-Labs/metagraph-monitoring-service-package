import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { IndividualNode } from '../groups/IndividualNode';

export default class L0ForkedNodes implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;

  name = 'L0 Forked Nodes';
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  allowanceListService: IAllowanceListService;
  loggerService: ILoggerService;

  private metagraphL0ForkedNodes: ISshService[] = [];

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.allowanceListService = monitoringConfiguration.allowanceListService;
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[ForkedNodes] ${message}`);
  }

  private async restartLayerNodes(
    unhealthyNodes: ISshService[],
    layer: AvailableLayers,
  ): Promise<void> {
    const unhealthyIps = unhealthyNodes.map((n) => n.metagraphNode.ip);

    this.loggerService.info(`[${layer}] Trying to get metagraphReferenceNode`);
    const referenceNode = this.sshServices
      .map((s) => s.metagraphNode)
      .find((n) => !unhealthyIps.includes(n.ip));

    if (!referenceNode) {
      throw new Error(
        `[${layer}] No healthy reference node available for layer ${layer}`,
      );
    }

    this.loggerService.info(`[${layer}] Starting individual nodes restart`);
    for (const node of unhealthyNodes) {
      this.loggerService.info(
        `[${layer}] Triggering restart of node: ${node.metagraphNode.ip}, with reference node: ${referenceNode.ip}`,
      );
      await new IndividualNode(
        this.monitoringConfiguration,
        node,
        referenceNode,
        this.globalNetworkService.referenceSourceNode,
        layer,
      ).performRestart();
    }
  }

  private async tryRestartIndividualNodes() {
    if (this.metagraphL0ForkedNodes.length > 0) {
      await this.restartLayerNodes(this.metagraphL0ForkedNodes, Layers.ML0);
    }
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.customLogger(`Checking if we have forked nodes`);
    this.metagraphL0ForkedNodes = [];
    const metagraphNodes = this.sshServices.map((it) => it.metagraphNode);

    this.customLogger(`[ML0] Checking if nodes are forked`);
    const forkedNodes =
      await this.metagraphService.getL0ForkedNodes(metagraphNodes);

    if (forkedNodes.length === 0) {
      return {
        shouldRestart: false,
        restartType: '',
      };
    }

    const forkedNodesIps = forkedNodes.map((it) => it.ip);

    this.metagraphL0ForkedNodes = this.sshServices.filter((it) =>
      forkedNodesIps.includes(it.metagraphNode.ip),
    );

    const restartType = `Individual nodes. Forked nodes:
               ML0: ${JSON.stringify(this.metagraphL0ForkedNodes.map((it) => it.metagraphNode.ip))}
            `;
    return {
      shouldRestart: true,
      restartType,
    };
  }

  async triggerRestart(): Promise<void> {
    await this.tryRestartIndividualNodes();
  }
}
