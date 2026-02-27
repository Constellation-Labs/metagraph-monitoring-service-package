import { createHash } from 'crypto';

import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import { MetagraphClusterInfo } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { FullLayer } from '../groups/FullLayer';
import { restartLayerNodes } from '../utils/restart-layer-nodes';

export default class UnhealthyNodes implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'Unhealthy Nodes';

  private layerRestarted: boolean = false;

  private metagraphL0UnhealthyNodes: ISshService[] = [];
  private currencyL1UnhealthyNodes: ISshService[] = [];
  private dataL1NUnhealthyNodes: ISshService[] = [];

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'UnhealthyNodes',
    );
  }

  private async tryRestartFullLayer() {
    if (
      this.metagraphL0UnhealthyNodes.length ===
      this.monitoringConfiguration.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.ML0,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (
      this.currencyL1UnhealthyNodes.length ===
      this.monitoringConfiguration.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.CL1,
      ).performRestart();

      this.layerRestarted = true;
    }
    if (
      this.dataL1NUnhealthyNodes.length ===
      this.monitoringConfiguration.config.metagraph.nodes.length
    ) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.DL1,
      ).performRestart();

      this.layerRestarted = true;
    }
  }

  private async tryRestartIndividualNodes() {
    if (this.metagraphL0UnhealthyNodes.length > 0) {
      await restartLayerNodes(
        this.monitoringConfiguration,
        this.metagraphL0UnhealthyNodes,
        Layers.ML0,
        this.logger,
      );
    }

    if (this.currencyL1UnhealthyNodes.length > 0) {
      await restartLayerNodes(
        this.monitoringConfiguration,
        this.currencyL1UnhealthyNodes,
        Layers.CL1,
        this.logger,
      );
    }

    if (this.dataL1NUnhealthyNodes.length > 0) {
      await restartLayerNodes(
        this.monitoringConfiguration,
        this.dataL1NUnhealthyNodes,
        Layers.DL1,
        this.logger,
      );
    }
  }

  private async getNodesPOV() {
    const allCl1POV: Record<string, MetagraphClusterInfo[]> = {};
    const allDl1POV: Record<string, MetagraphClusterInfo[]> = {};

    for (const sshService of this.monitoringConfiguration.sshServices) {
      if (
        !this.monitoringConfiguration.config.metagraph.layers.cl1.ignore_layer
      ) {
        this.logger.info(
          `[CL1] Fetching cluster POV from ${sshService.metagraphNode.ip}`,
        );
        const cl1POV =
          await this.monitoringConfiguration.metagraphService.getNodeClusterPOV(
            sshService.metagraphNode.ip,
            this.monitoringConfiguration.config.metagraph.layers.cl1.ports
              .public,
          );
        allCl1POV[sshService.metagraphNode.ip] = cl1POV;
      }

      if (
        !this.monitoringConfiguration.config.metagraph.layers.dl1.ignore_layer
      ) {
        this.logger.info(
          `[DL1] Fetching cluster POV from ${sshService.metagraphNode.ip}`,
        );
        const dl1POV =
          await this.monitoringConfiguration.metagraphService.getNodeClusterPOV(
            sshService.metagraphNode.ip,
            this.monitoringConfiguration.config.metagraph.layers.dl1.ports
              .public,
          );
        allDl1POV[sshService.metagraphNode.ip] = dl1POV;
      }
    }

    return {
      allCl1POV,
      allDl1POV,
    };
  }

  private performCheckForDifferentPOV(
    allClusterPOV: Record<string, MetagraphClusterInfo[]>,
    layer: string,
  ) {
    const normalizePOV = (infos: MetagraphClusterInfo[]) =>
      [...infos].sort((a, b) => a.id.localeCompare(b.id));

    const hashPOV = (infos: MetagraphClusterInfo[]): string => {
      const normalized = normalizePOV(infos);
      const str = JSON.stringify(normalized);
      return createHash('sha256').update(str).digest('hex');
    };

    const povHashes = Object.entries(allClusterPOV).map(([ip, infos]) => ({
      ip,
      hash: hashPOV(infos),
    }));

    const freq: Record<string, number> = {};
    for (const { hash } of povHashes) {
      freq[hash] = (freq[hash] ?? 0) + 1;
    }

    const majorityHash = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];

    this.logger.info(
      `[${layer}] POV hashes: ${povHashes.map((p) => `${p.ip}=${p.hash.slice(0, 8)}`).join(', ')}`,
    );
    this.logger.info(`[${layer}] Majority hash: ${majorityHash.slice(0, 8)}`);

    const unhealthyNodes = povHashes
      .filter(({ hash }) => hash !== majorityHash)
      .map(({ ip }) => ip);

    return unhealthyNodes;
  }

  private async getNodesWithDifferentPOV() {
    this.logger.info('Fetching cluster POV from all nodes');
    const { allCl1POV, allDl1POV } = await this.getNodesPOV();
    const unhealthyNodesPerLayer: Record<string, string[]> = {};

    if (Object.keys(allCl1POV).length > 0) {
      unhealthyNodesPerLayer[Layers.CL1] = this.performCheckForDifferentPOV(
        allCl1POV,
        Layers.CL1,
      );
    }
    if (Object.keys(allDl1POV).length > 0) {
      unhealthyNodesPerLayer[Layers.DL1] = this.performCheckForDifferentPOV(
        allDl1POV,
        Layers.DL1,
      );
    }

    return unhealthyNodesPerLayer;
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.logger.info('Checking for unhealthy nodes');
    this.metagraphL0UnhealthyNodes = [];
    this.currencyL1UnhealthyNodes = [];
    this.dataL1NUnhealthyNodes = [];
    const nodesWithDifferentPOV = await this.getNodesWithDifferentPOV();

    for (const sshService of this.monitoringConfiguration.sshServices) {
      const { metagraphNode } = sshService;
      this.logger.info(`[ML0] Checking node ${metagraphNode.ip}`);

      const ml0NodeIsHealthy =
        await this.monitoringConfiguration.metagraphService.checkIfNodeIsHealthy(
          metagraphNode.ip,
          this.monitoringConfiguration.config.metagraph.layers.ml0.ports.public,
        );

      if (!ml0NodeIsHealthy) {
        this.metagraphL0UnhealthyNodes.push(sshService);
      }

      if (
        !this.monitoringConfiguration.config.metagraph.layers.cl1.ignore_layer
      ) {
        this.logger.info(`[CL1] Checking node ${metagraphNode.ip}`);
        const cl1NodeIsHealthy =
          await this.monitoringConfiguration.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            this.monitoringConfiguration.config.metagraph.layers.cl1.ports
              .public,
          );

        const cl1NodesWithDifferentPOV =
          nodesWithDifferentPOV[Layers.CL1] || [];

        if (
          !cl1NodeIsHealthy ||
          cl1NodesWithDifferentPOV.includes(metagraphNode.ip)
        ) {
          this.currencyL1UnhealthyNodes.push(sshService);
        }
      }
      if (
        !this.monitoringConfiguration.config.metagraph.layers.dl1.ignore_layer
      ) {
        this.logger.info(`[DL1] Checking node ${metagraphNode.ip}`);
        const dl1NodeIsHealthy =
          await this.monitoringConfiguration.metagraphService.checkIfNodeIsHealthy(
            metagraphNode.ip,
            this.monitoringConfiguration.config.metagraph.layers.dl1!.ports!
              .public,
          );

        const dl1NodesWithDifferentPOV =
          nodesWithDifferentPOV[Layers.DL1] || [];

        if (
          !dl1NodeIsHealthy ||
          dl1NodesWithDifferentPOV.includes(metagraphNode.ip)
        ) {
          this.dataL1NUnhealthyNodes.push(sshService);
        }
      }
    }

    const shouldRestart =
      this.metagraphL0UnhealthyNodes.length > 0 ||
      this.currencyL1UnhealthyNodes.length > 0 ||
      this.dataL1NUnhealthyNodes.length > 0;

    const totalNodes =
      this.monitoringConfiguration.config.metagraph.nodes.length;
    const restartType =
      this.metagraphL0UnhealthyNodes.length === totalNodes
        ? 'Full Metagraph'
        : this.currencyL1UnhealthyNodes.length === totalNodes
          ? 'Full layer CL 1'
          : this.dataL1NUnhealthyNodes.length === totalNodes
            ? 'Full layer DL 1'
            : `Individual nodes — ML0: [${this.metagraphL0UnhealthyNodes.map((it) => it.metagraphNode.ip).join(', ')}] CL1: [${this.currencyL1UnhealthyNodes.map((it) => it.metagraphNode.ip).join(', ')}] DL1: [${this.dataL1NUnhealthyNodes.map((it) => it.metagraphNode.ip).join(', ')}]`;
    return {
      shouldRestart,
      restartType,
    };
  }

  async triggerRestart(): Promise<void> {
    this.layerRestarted = false;
    await this.tryRestartFullLayer();
    if (!this.layerRestarted) {
      await this.tryRestartIndividualNodes();
    }
  }
}
