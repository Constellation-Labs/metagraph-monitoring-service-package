import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import config from 'config/config.json';

import { FullLayer } from '../types/FullLayer';
import { IndividualNode } from '../types/IndividualNode';

export default class UnhealthyNodes implements IRestartCondition {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  private layerRestarted: boolean = false;

  private metagraphL0UnhealthyNodes: ISshService[] = [];
  private currencyL1UnhealthyNodes: ISshService[] = [];
  private dataL1NUnhealthyNodes: ISshService[] = [];

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetwokService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetwokService = globalNetwokService;
    this.seedlistService = seedlistService;
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[UnhealthyNodes] ${message}`);
  }

  private async tryRestartFullLayer() {
    if (
      this.metagraphL0UnhealthyNodes.length === config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.globalNetwokService.referenceSourceNode,
        Layers.ML0,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (
      this.currencyL1UnhealthyNodes.length === config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.globalNetwokService.referenceSourceNode,
        Layers.CL1,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (this.dataL1NUnhealthyNodes.length === config.metagraph.nodes.length) {
      await new FullLayer(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.globalNetwokService.referenceSourceNode,
        Layers.DL1,
      ).performRestart();

      this.layerRestarted = true;
    }
  }

  private async tryRestartIndividualNodes() {
    const metagraphNodes = this.sshServices.map((it) => it.metagraphNode);
    if (this.metagraphL0UnhealthyNodes.length > 0) {
      const unhealthyNodesIps = this.metagraphL0UnhealthyNodes.map(
        (it) => it.metagraphNode.ip,
      );
      const metagraphReferenceNode = metagraphNodes.find(
        (it) => !(it.ip in unhealthyNodesIps),
      );
      if (!metagraphReferenceNode) {
        throw Error(
          'Could not get reference node to restart individual node on layer metagraph-l0',
        );
      }
      for (const metagraphL0 of this.metagraphL0UnhealthyNodes) {
        await new IndividualNode(
          metagraphL0,
          this.metagraphService,
          this.seedlistService,
          this.logger,
          metagraphReferenceNode,
          this.globalNetwokService.referenceSourceNode,
          Layers.ML0,
        ).performRestart();
      }
    }
    if (this.currencyL1UnhealthyNodes.length > 0) {
      const unhealthyNodesIps = this.currencyL1UnhealthyNodes.map(
        (it) => it.metagraphNode.ip,
      );
      const metagraphReferenceNode = metagraphNodes.find(
        (it) => !(it.ip in unhealthyNodesIps),
      );
      if (!metagraphReferenceNode) {
        throw Error(
          'Could not get reference node to restart individual node on layer currency-l1',
        );
      }
      for (const currencyL1 of this.currencyL1UnhealthyNodes) {
        await new IndividualNode(
          currencyL1,
          this.metagraphService,
          this.seedlistService,
          this.logger,
          metagraphReferenceNode,
          this.globalNetwokService.referenceSourceNode,
          Layers.CL1,
        ).performRestart();
      }
    }
    if (this.dataL1NUnhealthyNodes.length > 0) {
      const unhealthyNodesIps = this.dataL1NUnhealthyNodes.map(
        (it) => it.metagraphNode.ip,
      );
      const metagraphReferenceNode = metagraphNodes.find((it) => {
        return !unhealthyNodesIps.includes(it.ip);
      });

      if (!metagraphReferenceNode) {
        throw Error(
          'Could not get reference node to restart individual node on layer data-l1',
        );
      }
      for (const dataL1 of this.dataL1NUnhealthyNodes) {
        await new IndividualNode(
          dataL1,
          this.metagraphService,
          this.seedlistService,
          this.logger,
          metagraphReferenceNode,
          this.globalNetwokService.referenceSourceNode,
          Layers.DL1,
        ).performRestart();
      }
    }
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.customLogger(`Checking if we have unhealthy nodes`);
    for (const sshService of this.sshServices) {
      const { metagraphNode } = sshService;
      this.customLogger(`[ML0] Checking node ${metagraphNode.ip}`);

      const ml0NodeIsHealthy = await this.metagraphService.checkIfNodeIsHealthy(
        metagraphNode.ip,
        config.metagraph.layers.ml0.ports.public,
      );
      if (!ml0NodeIsHealthy) {
        this.metagraphL0UnhealthyNodes.push(sshService);
      }

      if (!config.metagraph.layers.cl1.ignore_layer) {
        this.customLogger(`[CL1] Checking node ${metagraphNode.ip}`);
        const cl1NodeIsHealthy =
          await this.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            config.metagraph.layers.cl1.ports.public,
          );
        if (!cl1NodeIsHealthy) {
          this.currencyL1UnhealthyNodes.push(sshService);
        }
      }
      if (!config.metagraph.layers.dl1.ignore_layer) {
        this.customLogger(`[DL1] Checking node ${metagraphNode.ip}`);
        const dl1NodeIsHealthy =
          await this.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            config.metagraph.layers.dl1!.ports!.public,
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
            : `Individual nodes`;
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
