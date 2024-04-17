import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { MonitoringConfigs } from 'src';

import { FullMetagraph } from './FullMetagraph';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullLayer {
  private config: MonitoringConfigs;
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  referenceSourceNode: NetworkNode;
  layer: AvailableLayers;

  constructor(
    config: MonitoringConfigs,
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceSourceNode: NetworkNode,
    layer: AvailableLayers,
  ) {
    this.config = config;
    this.sshServices = sshServices;
    this.seedlistService = seedlistService;
    this.metagraphService = metagraphService;
    this.logger = logger;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
  }

  private customLogger(message: string) {
    this.logger.info(`[FullLayer] ${message}`);
  }

  private async killProcesses() {
    const promises = [];
    const killProcess = async (sshService: ISshService) => {
      this.customLogger(
        `Killing ${this.layer} current processes in node ${sshService.metagraphNode.ip}`,
      );

      await killCurrentExecution(
        sshService,
        this.config.metagraph.layers[this.layer].ports.public,
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
        this.config,
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceSourceNode,
      );
      return await fullCluster.performRestart();
    }

    if (this.layer === Layers.CL1) {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a layer restart`,
      );
      const currencyL1 = new CurrencyL1(
        this.config,
        rollbackHost,
        this.metagraphService,
        this.seedlistService,
        this.logger,
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
        this.config,
        rollbackHost,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      await dataL1.startCluster(validatorHosts);
    }
  }
}
