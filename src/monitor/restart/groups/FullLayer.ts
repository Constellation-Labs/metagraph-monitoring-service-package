import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullMetagraph } from './FullMetagraph';
import { Logger } from '../../../utils/logger';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { killJavaJarByLayer } from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullLayer {
  private monitoringConfiguration: MonitoringConfiguration;
  private config: Config;
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private logger: Logger;

  referenceSourceNode: NetworkNode;
  layer: AvailableLayers;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    referenceSourceNode: NetworkNode,
    layer: AvailableLayers,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'FullLayer',
    );
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
  }

  private async killProcesses() {
    const promises = [];
    const killProcess = async (sshService: ISshService) => {
      this.logger.info(
        `[${this.layer}] Killing processes on ${sshService.metagraphNode.ip}`,
      );

      await killJavaJarByLayer(
        sshService,
        this.layer,
        sshService.metagraphNode.ip,
      );

      this.logger.info(
        `[${this.layer}] Killed processes on ${sshService.metagraphNode.ip}`,
      );
    };

    for (const sshService of this.sshServices) {
      promises.push(killProcess(sshService));
    }

    await Promise.all(promises);
  }

  private async moveLogs() {
    const promises = [];
    const moveLogs = async (sshService: ISshService) => {
      this.logger.info(
        `[${this.layer}] Saving logs on ${sshService.metagraphNode.ip}`,
      );

      await saveCurrentLogs(sshService, this.layer);

      this.logger.info(
        `[${this.layer}] Saved logs on ${sshService.metagraphNode.ip}`,
      );
    };

    for (const sshService of this.sshServices) {
      promises.push(moveLogs(sshService));
    }

    await Promise.all(promises);
  }

  private async chooseRollbackNode(): Promise<ISshService> {
    const healthyNodes: ISshService[] = [];

    for (const sshService of this.sshServices) {
      const isHealthy = await this.metagraphService.checkIfNodeIsHealthy(
        sshService.metagraphNode.ip,
        this.config.metagraph.layers.ml0.ports.public,
      );

      if (isHealthy) {
        this.logger.info(
          `Node ${sshService.metagraphNode.ip} (node ${sshService.nodeNumber}) is healthy on ML0`,
        );
        healthyNodes.push(sshService);
      } else {
        this.logger.warn(
          `Node ${sshService.metagraphNode.ip} (node ${sshService.nodeNumber}) is unhealthy on ML0, skipping`,
        );
      }
    }

    if (healthyNodes.length > 0) {
      const selected =
        healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
      this.logger.info(
        `Randomly selected node ${selected.metagraphNode.ip} (node ${selected.nodeNumber}) as rollback node from ${healthyNodes.length} healthy node(s)`,
      );
      return selected;
    }

    const fallback =
      this.sshServices[Math.floor(Math.random() * this.sshServices.length)];
    this.logger.warn(
      `No healthy ML0 node found, randomly selecting fallback: ${fallback.metagraphNode.ip}`,
    );
    return fallback;
  }

  async performRestart() {
    await this.killProcesses();
    await this.moveLogs();

    const { nodes: metagraphNodes } = this.config.metagraph;
    const rollbackHost = await this.chooseRollbackNode();
    if (!rollbackHost) {
      throw Error(
        `Could not get rollback node from nodes: ${metagraphNodes.map((n) => n.ip).join(', ')}`,
      );
    }

    const validatorHosts = this.sshServices.filter(
      (it) => it.nodeNumber !== rollbackHost.nodeNumber,
    );

    this.logger.info(`Rollback node: ${rollbackHost.metagraphNode.ip}`);
    this.logger.info(
      `Validator nodes: ${validatorHosts.map((it) => it.metagraphNode.ip).join(', ')}`,
    );

    if (this.layer === Layers.ML0) {
      this.logger.warn(
        `All ${this.layer} nodes offline, triggering full metagraph restart`,
      );
      const fullCluster = new FullMetagraph(
        this.monitoringConfiguration,
        this.referenceSourceNode,
      );
      return await fullCluster.performRestart();
    }

    if (this.layer === Layers.CL1) {
      this.logger.warn(
        `All ${this.layer} nodes offline, triggering layer restart`,
      );
      const currencyL1 = new CurrencyL1(
        this.monitoringConfiguration,
        rollbackHost,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      await currencyL1.startCluster(validatorHosts);
    }

    if (this.layer === Layers.DL1) {
      this.logger.warn(
        `All ${this.layer} nodes offline, triggering layer restart`,
      );
      const dataL1 = new DataL1(
        this.monitoringConfiguration,
        rollbackHost,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      await dataL1.startCluster(validatorHosts);
    }
  }
}
