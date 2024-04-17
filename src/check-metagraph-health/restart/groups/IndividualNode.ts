import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers, NodeStatuses } from '@shared/constants';
import { MonitoringConfigs } from 'src';

import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';
import waitForNode from '../utils/wait-for-node';

export class IndividualNode {
  private config: MonitoringConfigs;
  private sshService: ISshService;
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  referenceMetagraphNode: MetagraphNode;
  referenceSourceNode: NetworkNode;
  layer: AvailableLayers;

  constructor(
    config: MonitoringConfigs,
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceMetagraphNode: MetagraphNode,
    referenceSourceNode: NetworkNode,
    layer: AvailableLayers,
  ) {
    this.config = config;
    this.sshService = sshService;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.logger = logger;
    this.referenceMetagraphNode = referenceMetagraphNode;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
  }

  private customLogger(message: string) {
    this.logger.info(`[IndividualNode] ${message}`);
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
        this.config,
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceSourceNode,
      );
      await metagraphL0.startValidatorNodeL0();
      await waitForNode(
        this.config,
        metagraphL0.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.logger,
      );
      await metagraphL0.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === Layers.CL1) {
      const currencyL1 = new CurrencyL1(
        this.config,
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await currencyL1.startValidatorNodeCl1();
      await waitForNode(
        this.config,
        currencyL1.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.logger,
      );
      await currencyL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === Layers.DL1) {
      const dataL1 = new DataL1(
        this.config,
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await dataL1.startValidatorNodeDl1();
      await waitForNode(
        this.config,
        dataL1.currentNode,
        this.layer,
        NodeStatuses.READY_TO_JOIN,
        this.logger,
      );
      await dataL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }
  }
}
