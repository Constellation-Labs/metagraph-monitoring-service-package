import axios from 'axios';

import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import { killJavaJarByLayer } from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';

type LastMetagraphBlockExplorerResponse = {
  data?: {
    hash?: string;
    ordinal?: number;
  };
};

export class FullMetagraph {
  private monitoringConfiguration: MonitoringConfiguration;
  private config: Config;
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private logger: Logger;

  referenceSourceNode: NetworkNode;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    referenceSourceNode: NetworkNode,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.referenceSourceNode = referenceSourceNode;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'FullMetagraph',
    );
  }

  private async killProcesses() {
    const promises = [];
    const killProcess = async (sshService: ISshService) => {
      this.logger.info(
        `Killing all layer processes on ${sshService.metagraphNode.ip}`,
      );

      await killJavaJarByLayer(
        sshService,
        Layers.ML0,
        sshService.metagraphNode.ip,
      );

      if (!this.config.metagraph.layers.cl1.ignore_layer) {
        await killJavaJarByLayer(
          sshService,
          Layers.CL1,
          sshService.metagraphNode.ip,
        );
      }

      if (!this.config.metagraph.layers.dl1.ignore_layer) {
        await killJavaJarByLayer(
          sshService,
          Layers.DL1,
          sshService.metagraphNode.ip,
        );
      }

      this.logger.info(
        `Killed all processes on ${sshService.metagraphNode.ip}`,
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
      this.logger.info(`Saving logs on ${sshService.metagraphNode.ip}`);

      await saveCurrentLogs(sshService, Layers.ML0);

      !this.config.metagraph.layers.cl1.ignore_layer &&
        (await saveCurrentLogs(sshService, Layers.CL1));

      !this.config.metagraph.layers.dl1.ignore_layer &&
        (await saveCurrentLogs(sshService, Layers.DL1));

      this.logger.info(`Saved logs on ${sshService.metagraphNode.ip}`);
    };

    for (const sshService of this.sshServices) {
      promises.push(moveLogs(sshService));
    }

    await Promise.all(promises);
  }

  private async chooseRollbackNode(): Promise<ISshService> {
    const { network, metagraph } = this.monitoringConfiguration.config;
    const url = `https://be-${network.name}.constellationnetwork.io/currency/${metagraph.id}/snapshots/latest`;

    let beResponse: LastMetagraphBlockExplorerResponse;
    try {
      const response = await axios.get(url);
      beResponse = response.data;
    } catch (error) {
      throw new Error(
        `Error fetching the last metagraph snapshot from block explorer: ${error}`,
      );
    }

    const lastSnapshotHash = beResponse.data?.hash;
    const lastSnapshotOrdinal = beResponse.data?.ordinal;
    if (!lastSnapshotHash || !lastSnapshotOrdinal) {
      throw new Error('Last metagraph snapshot hash/ordinal not found');
    }

    this.logger.info(
      `Last snapshot: ordinal=${lastSnapshotOrdinal}, hash=${lastSnapshotHash}`,
    );

    const nodesWithSnapshot: ISshService[] = [];

    for (const sshService of this.sshServices) {
      try {
        const command = `
        cd metagraph-l0
        ls data/incremental_snapshot/hash/${lastSnapshotHash.slice(0, 3)}/${lastSnapshotHash.slice(3, 6)}/${lastSnapshotHash} && ls data/calculated_state/${lastSnapshotOrdinal}
        `;

        await sshService.executeCommand(command, false);

        this.logger.info(
          `Node ${sshService.metagraphNode.ip} contains the last snapshot`,
        );
        nodesWithSnapshot.push(sshService);
      } catch {
        this.logger.warn(
          `Snapshot not found on node ${sshService.metagraphNode.ip}`,
        );
      }
    }

    if (nodesWithSnapshot.length > 0) {
      const selected =
        nodesWithSnapshot[Math.floor(Math.random() * nodesWithSnapshot.length)];
      this.logger.info(
        `Randomly selected node ${selected.metagraphNode.ip} as rollback node from ${nodesWithSnapshot.length} node(s) with snapshot`,
      );
      return selected;
    }

    const rollbackNode =
      this.sshServices[Math.floor(Math.random() * this.sshServices.length)];
    this.logger.warn(
      `No node contains snapshot ${lastSnapshotHash}, randomly selecting fallback: ${rollbackNode.metagraphNode.ip}`,
    );
    return rollbackNode;
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

    const metagraphL0 = new MetagraphL0(
      this.monitoringConfiguration,
      rollbackHost,
      this.referenceSourceNode,
    );
    await metagraphL0.startCluster(validatorHosts);

    const promises = [];
    if (!this.config.metagraph.layers.cl1.ignore_layer) {
      const currencyL1 = new CurrencyL1(
        this.monitoringConfiguration,
        rollbackHost,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      promises.push(currencyL1.startCluster(validatorHosts));
    }

    if (!this.config.metagraph.layers.dl1.ignore_layer) {
      const dataL1 = new DataL1(
        this.monitoringConfiguration,
        rollbackHost,
        rollbackHost.metagraphNode,
        this.referenceSourceNode,
      );
      promises.push(dataL1.startCluster(validatorHosts));
    }

    await Promise.all(promises);
  }
}
