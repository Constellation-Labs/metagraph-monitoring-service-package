import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullMetagraph } from './FullMetagraph';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { killJavaJarByLayer } from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullLayer {
  private monitoringConfiguration: MonitoringConfiguration;
  private config: Config;
  private sshServices: ISshService[];
  private loggerService: ILoggerService;

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
    this.loggerService = monitoringConfiguration.loggerService;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
  }

  private customLogger(message: string) {
    this.loggerService.info(`[FullLayer] ${message}`);
  }

  private async killProcesses() {
    const promises = [];
    const killProcess = async (sshService: ISshService) => {
      this.customLogger(
        `Killing ${this.layer} current processes in node ${sshService.metagraphNode.ip}`,
      );

      await killJavaJarByLayer(
        sshService,
        this.layer,
        sshService.metagraphNode.ip,
      );

      this.customLogger(
        `Finished killing processes in node ${sshService.metagraphNode.ip}`,
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
      this.customLogger(
        `Saving current logs of ${this.layer} in node ${sshService.metagraphNode.ip}`,
      );

      await saveCurrentLogs(sshService, this.layer);

      this.customLogger(
        `Finished saving current logs in node ${sshService.metagraphNode.ip}`,
      );
    };

    for (const sshService of this.sshServices) {
      promises.push(moveLogs(sshService));
    }

    await Promise.all(promises);
  }

  async performRestart() {
    await this.killProcesses();
    await this.moveLogs();

    const { nodes: metagraphNodes } = this.config.metagraph;
    const rollbackHost = this.sshServices.find((it) => it.nodeNumber === 1);
    if (!rollbackHost) {
      throw Error(
        `Could not get the rollback node from nodes: ${JSON.stringify(metagraphNodes)}`,
      );
    }

    const validatorHosts = this.sshServices.filter((it) => it.nodeNumber !== 1);

    this.customLogger(
      `Rollback node: ${JSON.stringify(rollbackHost.metagraphNode)}`,
    );
    this.customLogger(
      `Validator nodes: ${JSON.stringify(validatorHosts.map((it) => it.metagraphNode))}`,
    );

    if (this.layer === Layers.ML0) {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a full restart`,
      );
      const fullCluster = new FullMetagraph(
        this.monitoringConfiguration,
        this.referenceSourceNode,
      );
      return await fullCluster.performRestart();
    }

    if (this.layer === Layers.CL1) {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a layer restart`,
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
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a layer restart`,
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
