import config from '@config/config.json';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';

import { FullMetagraph } from './FullMetagraph';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullLayer {
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  referenceSourceNode: NetworkNode;
  layer: Layers;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceSourceNode: NetworkNode,
    layer: Layers,
  ) {
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
    for (const sshService of this.sshServices) {
      this.customLogger(
        `Killing ${this.layer} current processes in node ${sshService.metagraphNode.ip}`,
      );

      await killCurrentExecution(
        sshService,
        config.metagraph.layers[this.layer].ports.public,
      );

      this.customLogger(
        `Finished killing processes in node ${sshService.metagraphNode.ip}`,
      );
    }
  }

  private async moveLogs() {
    for (const sshService of this.sshServices) {
      this.customLogger(
        `Saving current logs of ${this.layer} in node ${sshService.metagraphNode.ip}`,
      );

      await saveCurrentLogs(sshService, this.layer);

      this.customLogger(
        `Finished saving current logs in node ${sshService.metagraphNode.ip}`,
      );
    }
  }

  async performRestart() {
    await this.killProcesses();
    await this.moveLogs();

    const { nodes: metagraphNodes } = config.metagraph;
    const rollbackHost = this.sshServices.find((it) => it.nodeNumber === 1);
    if (!rollbackHost) {
      throw Error(
        `Could not get the rollback node from nodes: ${JSON.stringify(metagraphNodes)}`,
      );
    }

    const validatorHosts = this.sshServices.filter((it) => it.nodeNumber !== 1);

    this.customLogger(`Rollback node: ${JSON.stringify(rollbackHost)}`);
    this.customLogger(`Validator nodes: ${JSON.stringify(validatorHosts)}`);

    if (this.layer === 'ml0') {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a full restart`,
      );
      const fullCluster = new FullMetagraph(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceSourceNode,
      );
      return await fullCluster.performRestart();
    }

    if (this.layer === 'cl1') {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a layer restart`,
      );
      const currencyL1 = new CurrencyL1(
        rollbackHost,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      await currencyL1.startCluster(validatorHosts);
    }

    if (this.layer === 'dl1') {
      this.customLogger(
        `All layer ${this.layer} is offline, triggering a layer restart`,
      );
      const dataL1 = new DataL1(
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
