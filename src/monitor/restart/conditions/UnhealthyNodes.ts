import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullLayer } from '../groups/FullLayer';
import { IndividualNode } from '../groups/IndividualNode';

export default class UnhealthyNodes implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;

  name = 'Unhealthy Nodes';
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  loggerService: ILoggerService;

  private layerRestarted: boolean = false;

  private metagraphL0UnhealthyNodes: ISshService[] = [];
  private currencyL1UnhealthyNodes: ISshService[] = [];
  private dataL1NUnhealthyNodes: ISshService[] = [];

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[UnhealthyNodes] ${message}`);
  }

  private async tryRestartFullLayer() {
    if (
      this.metagraphL0UnhealthyNodes.length ===
      this.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.globalNetworkService.referenceSourceNode,
        Layers.ML0,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (
      this.currencyL1UnhealthyNodes.length ===
      this.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.globalNetworkService.referenceSourceNode,
        Layers.CL1,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (
      this.dataL1NUnhealthyNodes.length === this.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.globalNetworkService.referenceSourceNode,
        Layers.DL1,
      ).performRestart();

      this.layerRestarted = true;
    }
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
    if (this.metagraphL0UnhealthyNodes.length > 0) {
      await this.restartLayerNodes(this.metagraphL0UnhealthyNodes, Layers.ML0);
    }

    if (this.currencyL1UnhealthyNodes.length > 0) {
      await this.restartLayerNodes(this.currencyL1UnhealthyNodes, Layers.CL1);
    }

    if (this.dataL1NUnhealthyNodes.length > 0) {
      await this.restartLayerNodes(this.dataL1NUnhealthyNodes, Layers.DL1);
    }
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.customLogger(`Checking if we have unhealthy nodes`);
    this.metagraphL0UnhealthyNodes = [];
    this.currencyL1UnhealthyNodes = [];
    this.dataL1NUnhealthyNodes = [];
    for (const sshService of this.sshServices) {
      const { metagraphNode } = sshService;
      this.customLogger(`[ML0] Checking node ${metagraphNode.ip}`);

      const ml0NodeIsHealthy = await this.metagraphService.checkIfNodeIsHealthy(
        metagraphNode.ip,
        this.config.metagraph.layers.ml0.ports.public,
      );
      if (!ml0NodeIsHealthy) {
        this.metagraphL0UnhealthyNodes.push(sshService);
      }

      if (!this.config.metagraph.layers.cl1.ignore_layer) {
        this.customLogger(`[CL1] Checking node ${metagraphNode.ip}`);
        const cl1NodeIsHealthy =
          await this.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            this.config.metagraph.layers.cl1.ports.public,
          );
        if (!cl1NodeIsHealthy) {
          this.currencyL1UnhealthyNodes.push(sshService);
        }
      }
      if (!this.config.metagraph.layers.dl1.ignore_layer) {
        this.customLogger(`[DL1] Checking node ${metagraphNode.ip}`);
        const dl1NodeIsHealthy =
          await this.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            this.config.metagraph.layers.dl1!.ports!.public,
          );

        if (!dl1NodeIsHealthy) {
          this.dataL1NUnhealthyNodes.push(sshService);
        }
      }
    }

    const shouldRestart =
      this.metagraphL0UnhealthyNodes.length > 0 ||
      this.currencyL1UnhealthyNodes.length > 0 ||
      this.dataL1NUnhealthyNodes.length > 0;

    const restartType =
      this.metagraphL0UnhealthyNodes.length === 3
        ? 'Full Metagraph'
        : this.currencyL1UnhealthyNodes.length === 3
          ? 'Full layer CL 1'
          : this.dataL1NUnhealthyNodes.length === 3
            ? 'Full layer DL 1'
            : `Individual nodes. Unhealthy nodes:
               ML0: ${JSON.stringify(this.metagraphL0UnhealthyNodes.map((it) => it.metagraphNode.ip))}
               CL1: ${JSON.stringify(this.currencyL1UnhealthyNodes.map((it) => it.metagraphNode.ip))}
               DL1: ${JSON.stringify(this.dataL1NUnhealthyNodes.map((it) => it.metagraphNode.ip))}
            `;
    return {
      shouldRestart,
      restartType,
    };
  }

  async triggerRestart(): Promise<void> {
    await this.tryRestartFullLayer();
    if (!this.layerRestarted) {
      await this.tryRestartIndividualNodes();
    }
  }
}
