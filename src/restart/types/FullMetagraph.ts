import config from '@config/config.json';
import { NetworkNode } from '@interfaces/global-network/types';
import IMetagraphService from '@interfaces/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/seedlist/ISeedlistService';
import ISshService from '@interfaces/ssh/ISshService';
import { LogsNames } from '@utils/get-logs-names';

import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullMetagraph {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  seedlistService: ISeedlistService;
  referenceSourceNode: NetworkNode;
  logsNames: LogsNames;
  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceSourceNode: NetworkNode,
    logsNames: LogsNames,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.referenceSourceNode = referenceSourceNode;
    this.logsNames = logsNames;
  }

  private async killProcesses() {
    for (const sshService of this.sshServices) {
      await killCurrentExecution(
        sshService,
        config.metagraph.layers.ml0.ports.public,
      );
      await killCurrentExecution(
        sshService,
        config.metagraph.layers.cl1.ports.public,
      );
      await killCurrentExecution(
        sshService,
        config.metagraph.layers.dl1.ports.public,
      );
    }
  }

  private async moveLogs() {
    for (const sshService of this.sshServices) {
      await saveCurrentLogs(sshService, 'ml0', this.logsNames);
      await saveCurrentLogs(sshService, 'cl1', this.logsNames);
      await saveCurrentLogs(sshService, 'dl1', this.logsNames);
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

    const metagraphL0 = new MetagraphL0(
      rollbackHost,
      this.metagraphService,
      this.seedlistService,
      this.referenceSourceNode,
      this.logsNames.ml0LogName,
    );
    await metagraphL0.startCluster(validatorHosts);

    if ('cl1' in config.metagraph.layers) {
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

    if ('dl1' in config.metagraph.layers) {
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
