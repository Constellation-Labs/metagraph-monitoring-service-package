import config from '@config/config.json';
import { NetworkNode } from '@interfaces/IGlobalNetworkService';
import IMetagraphService from '@interfaces/IMetagraphService';
import ISeedlistService from '@interfaces/ISeedlistService';
import ISshService from '@interfaces/ISshService';
import { Layers } from '@shared/constants';
import { LogsNames } from '@utils/get-logs-names';

import { FullMetagraph } from './FullMetagraph';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullLayer {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  seedlistService: ISeedlistService;

  referenceSourceNode: NetworkNode;
  layer: Layers;
  logsNames: LogsNames;
  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceSourceNode: NetworkNode,
    layer: Layers,
    logsNames: LogsNames,
  ) {
    this.sshServices = sshServices;
    this.seedlistService = seedlistService;
    this.metagraphService = metagraphService;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
    this.logsNames = logsNames;
  }

  private async killProcesses() {
    for (const sshService of this.sshServices) {
      await killCurrentExecution(
        sshService,
        config.metagraph.layers[this.layer].ports.public,
      );
    }
  }

  private async moveLogs() {
    for (const sshService of this.sshServices) {
      await saveCurrentLogs(sshService, this.layer, this.logsNames);
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

    if (this.layer === 'ml0') {
      const fullCluster = new FullMetagraph(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        this.referenceSourceNode,
        this.logsNames,
      );
      return await fullCluster.performRestart();
    }

    if (this.layer === 'cl1') {
      const currencyL1 = new CurrencyL1(
        rollbackHost,
        this.metagraphService,
        this.seedlistService,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
        this.logsNames.ml0LogName,
      );
      await currencyL1.startCluster(validatorHosts);
    }

    if (this.layer === 'dl1') {
      const dataL1 = new DataL1(
        rollbackHost,
        this.metagraphService,
        this.seedlistService,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
        this.logsNames.ml0LogName,
      );
      await dataL1.startCluster(validatorHosts);
    }
  }
}
