import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers, NodeStatuses } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';
import sleep from '../utils/sleep';
import waitForNode from '../utils/wait-for-node';

export class IndividualNode {
  private monitoringConfiguration: MonitoringConfiguration;
  private config: Config;
  private sshService: ISshService;
  private loggerService: ILoggerService;

  referenceMetagraphNode: MetagraphNode;
  referenceSourceNode: NetworkNode;
  layer: AvailableLayers;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    sshService: ISshService,
    referenceMetagraphNode: MetagraphNode,
    referenceSourceNode: NetworkNode,
    layer: AvailableLayers,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshService = sshService;
    this.loggerService = monitoringConfiguration.loggerService;
    this.referenceMetagraphNode = referenceMetagraphNode;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
  }

  private customLogger(message: string) {
    this.loggerService.info(`[IndividualNode] ${message}`);
  }

  private async killProcess() {
    this.customLogger(
      `Killing ${this.layer} current processes in node ${this.sshService.metagraphNode.ip}`,
    );

    await killCurrentExecution(
      this.sshService,
      this.config.metagraph.layers[this.layer].ports.public,
    );

    this.customLogger(
      `Finished killing processes in node ${this.sshService.metagraphNode.ip}`,
    );
  }

  private async moveLog() {
    this.customLogger(
      `Saving current logs of ${this.layer} in node ${this.sshService.metagraphNode.ip}`,
    );

    await saveCurrentLogs(this.sshService, this.layer);

    this.customLogger(
      `Finished saving current logs in node ${this.sshService.metagraphNode.ip}`,
    );
  }

  async performRestart() {
    await this.killProcess();
    await this.moveLog();

    if (this.layer === Layers.ML0) {
      const metagraphL0 = new MetagraphL0(
        this.monitoringConfiguration,
        this.sshService,
        this.referenceSourceNode,
      );
      await metagraphL0.startValidatorNodeL0();
      await waitForNode(
        this.config,
        metagraphL0.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.loggerService,
      );
      await sleep(5 * 1000);
      await metagraphL0.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === Layers.CL1) {
      const currencyL1 = new CurrencyL1(
        this.monitoringConfiguration,
        this.sshService,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await currencyL1.startValidatorNodeCl1();
      await waitForNode(
        this.config,
        currencyL1.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.loggerService,
      );
      await sleep(5 * 1000);
      await currencyL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === Layers.DL1) {
      const dataL1 = new DataL1(
        this.monitoringConfiguration,
        this.sshService,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await dataL1.startValidatorNodeDl1();
      await waitForNode(
        this.config,
        dataL1.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.loggerService,
      );
      await sleep(5 * 1000);
      await dataL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }
  }
}
