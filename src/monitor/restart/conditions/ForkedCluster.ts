import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

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

  name = 'Forked Cluster';
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  allowanceListService: IAllowanceListService;
  loggerService: ILoggerService;

  private shouldRestartML0: boolean = false;
  private shouldRestartCL1: boolean = false;
  private shouldRestartDL1: boolean = false;

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

  private customLogger(message: string) {
    this.loggerService.info(`[ForkedCluster] ${message}`);
  }

  private async checkLayerFork(
    nodeIp: string,
    port: number,
    sourceNodeIps: string[],
  ): Promise<boolean> {
    const clusterPOV = await this.metagraphService.getNodeClusterPOV(
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
        this.globalNetworkService.referenceSourceNode,
        Layers.ML0,
      ).performRestart();
      this.shouldRestartML0 = false;
    }
    if (this.shouldRestartCL1) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.globalNetworkService.referenceSourceNode,
        Layers.CL1,
      ).performRestart();
      this.shouldRestartCL1 = false;
    }
    if (this.shouldRestartDL1) {
      await new FullLayer(
        this.monitoringConfiguration,
        this.globalNetworkService.referenceSourceNode,
        Layers.DL1,
      ).performRestart();
      this.shouldRestartDL1 = false; // Fixed: was incorrectly set to true
    }
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.customLogger('Checking if we have forked cluster');
    const metagraphNodes = this.sshServices.map((it) => it.metagraphNode);
    const sourceNodeIps = metagraphNodes.map((node) => node.ip);

    for (const node of metagraphNodes) {
      this.customLogger(`NODE: ${node.ip} point of view`);
      this.customLogger('Checking if the ML0 majority cluster is forked');
      // Check ML0
      if (
        await this.checkLayerFork(
          node.ip,
          this.config.metagraph.layers.ml0.ports.public,
          sourceNodeIps,
        )
      ) {
        this.customLogger('ML0 majority cluster FORKED, triggering restart');
        this.shouldRestartML0 = true;
        return { shouldRestart: true, restartType: 'ML0 Cluster Forked' };
      }
      this.customLogger('ML0 majority cluster NOT FORKED');

      if (!this.config.metagraph.layers.cl1.ignore_layer) {
        this.customLogger('Checking if the CL1 majority cluster is forked');
        // Check CL1
        if (
          await this.checkLayerFork(
            node.ip,
            this.config.metagraph.layers.cl1.ports.public,
            sourceNodeIps,
          )
        ) {
          this.customLogger('CL1 majority cluster FORKED, triggering restart');
          this.shouldRestartCL1 = true;
          return { shouldRestart: true, restartType: 'CL1 Cluster Forked' };
        }
        this.customLogger('CL1 majority cluster NOT FORKED');
      }

      if (!this.config.metagraph.layers.dl1.ignore_layer) {
        this.customLogger('Checking if the DL1 majority cluster is forked');
        // Check DL1
        if (
          await this.checkLayerFork(
            node.ip,
            this.config.metagraph.layers.dl1.ports.public,
            sourceNodeIps,
          )
        ) {
          this.customLogger('DL1 majority cluster FORKED, triggering restart');
          this.shouldRestartDL1 = true;
          return { shouldRestart: true, restartType: 'DL1 Cluster Forked' };
        }
        this.customLogger('DL1 majority cluster NOT FORKED');
      }
    }

    this.shouldRestartML0 = false;
    this.shouldRestartCL1 = false;
    this.shouldRestartDL1 = false;

    this.customLogger('None of the clusters are forked');
    return { shouldRestart: false, restartType: '' };
  }

  async triggerRestart(): Promise<void> {
    await this.tryRestartFullLayer();
  }
}
