import config from '@config/config.json';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import cleanupSnapshotsGreaterThanRollback from '../utils/cleanup-snapshots-greater-than-rollback';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

export class FullMetagraph {
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  referenceSourceNode: NetworkNode;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceSourceNode: NetworkNode,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.referenceSourceNode = referenceSourceNode;
    this.logger = logger;
  }

  private customLogger(message: string) {
    this.logger.info(`[FullMetagraph] ${message}`);
  }

  private async killProcesses() {
    for (const sshService of this.sshServices) {
      this.customLogger(
        `Killing all layers current processes in node ${sshService.metagraphNode.ip}`,
      );

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

      this.customLogger(
        `Finished killing processes in node ${sshService.metagraphNode.ip}`,
      );
    }
  }

  private async moveLogs() {
    for (const sshService of this.sshServices) {
      this.customLogger(
        `Saving current logs of all layers in node ${sshService.metagraphNode.ip}`,
      );

      await saveCurrentLogs(sshService, 'ml0');
      await saveCurrentLogs(sshService, 'cl1');
      await saveCurrentLogs(sshService, 'dl1');

      this.customLogger(
        `Finished saving current logs in node ${sshService.metagraphNode.ip}`,
      );
    }
  }

  private async cleanupSnapshots() {
    const initialSnapshot =
      this.metagraphService.metagraphSnapshotInfo.lastSnapshotOrdinal + 1;
    const finalSnapshot =
      this.metagraphService.metagraphSnapshotInfo.lastSnapshotOrdinal + 200;

    for (const sshService of this.sshServices) {
      this.customLogger(
        `Cleaning snapshots between ${initialSnapshot} and ${finalSnapshot} in node ${sshService.metagraphNode.ip}`,
      );

      await cleanupSnapshotsGreaterThanRollback(
        sshService,
        initialSnapshot,
        finalSnapshot,
      );

      this.customLogger(
        `Finished cleaning snapshots between ${initialSnapshot} and ${finalSnapshot} in node ${sshService.metagraphNode.ip}`,
      );
    }
  }

  async performRestart() {
    await this.killProcesses();
    await this.moveLogs();
    await this.cleanupSnapshots();

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

    const metagraphL0 = new MetagraphL0(
      rollbackHost,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.referenceSourceNode,
    );
    await metagraphL0.startCluster(validatorHosts);

    if ('cl1' in config.metagraph.layers) {
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

    if ('dl1' in config.metagraph.layers) {
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
