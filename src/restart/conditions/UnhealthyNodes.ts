import { NetworkNode } from '@interfaces/global-network/types';
import IMetagraphService from '@interfaces/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/seedlist/ISeedlistService';
import ISshService from '@interfaces/ssh/ISshService';
import { LogsNames } from '@utils/get-logs-names';
import config from 'config/config.json';

import { FullLayer } from '../types/FullLayer';
import { IndividualNode } from '../types/IndividualNode';

export default class UnhealthyNodes {
  private metagraphService: IMetagraphService;
  private sshServices: ISshService[];
  private seedlistService: ISeedlistService;
  private referenceSourceNode: NetworkNode;
  private logsNames: LogsNames;
  private layerRestarted: boolean = false;

  private metagraphL0UnhealthyNodes: ISshService[] = [];
  private currencyL1UnhealthyNodes: ISshService[] = [];
  private dataL1NUnhealthyNodes: ISshService[] = [];

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceSourceNode: NetworkNode,
    logsNames: LogsNames,
  ) {
    this.metagraphService = metagraphService;
    this.sshServices = sshServices;
    this.seedlistService = seedlistService;
    this.referenceSourceNode = referenceSourceNode;
    this.logsNames = logsNames;
  }

  private async tryRestartFullLayer() {
    if (
      this.metagraphL0UnhealthyNodes.length === config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.referenceSourceNode,
        'ml0',
        this.logsNames,
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
        this.referenceSourceNode,
        'cl1',
        this.logsNames,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (this.dataL1NUnhealthyNodes.length === config.metagraph.nodes.length) {
      await new FullLayer(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.referenceSourceNode,
        'dl1',
        this.logsNames,
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
          metagraphReferenceNode,
          this.referenceSourceNode,
          'ml0',
          this.logsNames,
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
          metagraphReferenceNode,
          this.referenceSourceNode,
          'cl1',
          this.logsNames,
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

      // console.log(
      //   `metagraphReferenceNode: ${JSON.stringify(metagraphReferenceNode)}`,
      // );
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
          metagraphReferenceNode,
          this.referenceSourceNode,
          'dl1',
          this.logsNames,
        ).performRestart();
      }
    }
  }

  async shouldRestartMetagraph(): Promise<boolean> {
    console.log(`Checking if nodes are unhealthy`);
    for (const sshService of this.sshServices) {
      const { metagraphNode } = sshService;
      const ml0NodeIsHealthy = await this.metagraphService.checkIfNodeIsHealthy(
        metagraphNode.ip,
        config.metagraph.layers.ml0.ports.public,
      );
      const cl1NodeIsHealthy =
        'cl1' in config.metagraph.layers
          ? await this.metagraphService.checkIfNodeIsHealthy(
              metagraphNode.ip,
              config.metagraph.layers.cl1.ports.public,
            )
          : true;
      const dl1NodeIsHealthy =
        'dl1' in config.metagraph.layers
          ? await this.metagraphService.checkIfNodeIsHealthy(
              metagraphNode.ip,
              config.metagraph.layers.dl1.ports.public,
            )
          : true;

      if (!ml0NodeIsHealthy) {
        this.metagraphL0UnhealthyNodes.push(sshService);
      }
      if (!cl1NodeIsHealthy) {
        this.currencyL1UnhealthyNodes.push(sshService);
      }
      if (!dl1NodeIsHealthy) {
        this.dataL1NUnhealthyNodes.push(sshService);
      }
    }

    return (
      this.metagraphL0UnhealthyNodes.length > 0 ||
      this.currencyL1UnhealthyNodes.length > 0 ||
      this.dataL1NUnhealthyNodes.length > 0
    );
  }

  async triggerRestart(): Promise<void> {
    await this.tryRestartFullLayer();
    if (!this.layerRestarted) {
      await this.tryRestartIndividualNodes();
    }
  }
}
