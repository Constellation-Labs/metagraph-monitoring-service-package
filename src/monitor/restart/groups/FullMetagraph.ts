import axios from 'axios';

import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

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
  private loggerService: ILoggerService;

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
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private customLogger(message: string) {
    this.loggerService.info(`[FullMetagraph] ${message}`);
  }

  private async killProcesses() {
    const promises = [];
    const killProcess = async (sshService: ISshService) => {
      this.customLogger(
        `Killing all layers current processes in node ${sshService.metagraphNode.ip}`,
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

      if (!this.config.metagraph.layers.cl1.ignore_layer) {
        await killJavaJarByLayer(
          sshService,
          Layers.DL1,
          sshService.metagraphNode.ip,
        );
      }

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
        `Saving current logs of all layers in node ${sshService.metagraphNode.ip}`,
      );

      await saveCurrentLogs(sshService, Layers.ML0);

      !this.config.metagraph.layers.cl1.ignore_layer &&
        (await saveCurrentLogs(sshService, Layers.CL1));

      !this.config.metagraph.layers.dl1.ignore_layer &&
        (await saveCurrentLogs(sshService, Layers.DL1));

      this.customLogger(
        `Finished saving current logs in node ${sshService.metagraphNode.ip}`,
      );
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

    this.customLogger(
      `Last metagraph snapshot found in URL ${url}: ${lastSnapshotHash} - ${lastSnapshotOrdinal}`,
    );

    for (const sshService of this.sshServices) {
      try {
        const command = `
        cd metagraph-l0
        ls data/incremental_snapshot/hash/${lastSnapshotHash.slice(0, 3)}/${lastSnapshotHash.slice(3, 6)}/${lastSnapshotHash} && ls data/calculated_state/${lastSnapshotOrdinal}
        `;

        await sshService.executeCommand(command, false);

        this.customLogger(
          `Node ${sshService.metagraphNode.ip} will be the rollback node`,
        );

        return sshService;
      } catch {
        this.customLogger(
          `Snapshot not found on node: ${sshService.metagraphNode.ip}`,
        );
      }
    }
    const message = `No node contains the last snapshot ${lastSnapshotHash}`;
    this.customLogger(message);
    throw Error(message);
  }

  async performRestart() {
    await this.killProcesses();
    await this.moveLogs();

    const { nodes: metagraphNodes } = this.config.metagraph;

    const rollbackHost = await this.chooseRollbackNode();
    if (!rollbackHost) {
      throw Error(
        `Could not get the rollback node from nodes: ${JSON.stringify(metagraphNodes)}`,
      );
    }

    const validatorHosts = this.sshServices.filter(
      (it) => it.nodeNumber !== rollbackHost.nodeNumber,
    );

    this.customLogger(
      `Rollback node: ${JSON.stringify(rollbackHost.metagraphNode)}`,
    );
    this.customLogger(
      `Validator nodes: ${JSON.stringify(validatorHosts.map((it) => it.metagraphNode))}`,
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
