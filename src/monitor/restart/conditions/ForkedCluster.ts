import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import { Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { FullLayer } from '../groups';

/**
 * Detects and handles forked clusters in the metagraph network by implementing the
 * `IRestartCondition` interface.
 *
 * This class checks if ML0, CL1, or DL1 layers are forked by comparing the cluster view
 * of each node against the expected node list. If a fork is detected, it sets flags to
 * trigger a full-layer restart.
 *
 * Use `shouldRestart()` to determine if a restart is needed, and `triggerRestart()` to
 * execute it.
 */
export default class ForkedCluster implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'Forked Cluster';

  private shouldRestartML0: boolean = false;
  private shouldRestartCL1: boolean = false;
  private shouldRestartDL1: boolean = false;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'ForkedCluster',
    );
  }

  private async checkLayerFork(
    nodeIp: string,
    port: number,
    sourceNodeIps: string[],
  ): Promise<boolean> {
    const clusterPOV =
      await this.monitoringConfiguration.metagraphService.getNodeClusterPOV(
        nodeIp,
        port,
      );
    const clusterIps = clusterPOV.map((it) => it.ip);
    return !sourceNodeIps.every((item) => clusterIps.includes(item));
  }

  private async tryRestartFullLayer() {
    if (this.shouldRestartML0) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.ML0,
      ).performRestart();
      this.shouldRestartML0 = false;
    }
    if (this.shouldRestartCL1) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.CL1,
      ).performRestart();
      this.shouldRestartCL1 = false;
    }
    if (this.shouldRestartDL1) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
        Layers.DL1,
      ).performRestart();
      this.shouldRestartDL1 = false; // Fixed: was incorrectly set to true
    }
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.logger.info('Checking for forked clusters');
    const metagraphNodes = this.monitoringConfiguration.sshServices.map(
      (it) => it.metagraphNode,
    );
    const sourceNodeIps = metagraphNodes.map((node) => node.ip);

    for (const node of metagraphNodes) {
      this.logger.info(`Checking cluster POV from node ${node.ip}`);
      this.logger.info('[ML0] Checking cluster fork status');
      if (
        await this.checkLayerFork(
          node.ip,
          this.monitoringConfiguration.config.metagraph.layers.ml0.ports.public,
          sourceNodeIps,
        )
      ) {
        this.logger.warn(`[ML0] Cluster forked from ${node.ip} POV`);
        this.shouldRestartML0 = true;
        return { shouldRestart: true, restartType: 'ML0 Cluster Forked' };
      }
      this.logger.info('[ML0] Cluster is consistent');

      if (
        !this.monitoringConfiguration.config.metagraph.layers.cl1.ignore_layer
      ) {
        this.logger.info('[CL1] Checking cluster fork status');
        if (
          await this.checkLayerFork(
            node.ip,
            this.monitoringConfiguration.config.metagraph.layers.cl1.ports
              .public,
            sourceNodeIps,
          )
        ) {
          this.logger.warn(`[CL1] Cluster forked from ${node.ip} POV`);
          this.shouldRestartCL1 = true;
          return { shouldRestart: true, restartType: 'CL1 Cluster Forked' };
        }
        this.logger.info('[CL1] Cluster is consistent');
      }

      if (
        !this.monitoringConfiguration.config.metagraph.layers.dl1.ignore_layer
      ) {
        this.logger.info('[DL1] Checking cluster fork status');
        if (
          await this.checkLayerFork(
            node.ip,
            this.monitoringConfiguration.config.metagraph.layers.dl1.ports
              .public,
            sourceNodeIps,
          )
        ) {
          this.logger.warn(`[DL1] Cluster forked from ${node.ip} POV`);
          this.shouldRestartDL1 = true;
          return { shouldRestart: true, restartType: 'DL1 Cluster Forked' };
        }
        this.logger.info('[DL1] Cluster is consistent');
      }
    }

    this.shouldRestartML0 = false;
    this.shouldRestartCL1 = false;
    this.shouldRestartDL1 = false;

    this.logger.info('All clusters are consistent');
    return { shouldRestart: false, restartType: '' };
  }

  async triggerRestart(): Promise<void> {
    await this.tryRestartFullLayer();
  }
}
