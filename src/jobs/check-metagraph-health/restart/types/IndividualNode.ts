import config from '@config/config.json';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers } from '@shared/constants';

import { CurrencyL1 } from '../layers/CurrencyL1';
import { DataL1 } from '../layers/DataL1';
import { MetagraphL0 } from '../layers/MetagraphL0';
import killCurrentExecution from '../utils/kill-current-execution';
import saveCurrentLogs from '../utils/save-current-logs';
import waitForNode from '../utils/wait-for-node';

export class IndividualNode {
  private sshService: ISshService;
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  referenceMetagraphNode: MetagraphNode;
  referenceSourceNode: NetworkNode;
  layer: Layers;

  constructor(
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceMetagraphNode: MetagraphNode,
    referenceSourceNode: NetworkNode,
    layer: Layers,
  ) {
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
      config.metagraph.layers[this.layer].ports.public,
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

    if (this.layer === 'ml0') {
      const metagraphL0 = new MetagraphL0(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceSourceNode,
      );
      await metagraphL0.startValidatorNodeL0();
      await waitForNode(
        metagraphL0.currentNode,
        this.layer,
        'ReadyToJoin',
        this.logger,
      );
      await metagraphL0.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === 'cl1') {
      const currencyL1 = new CurrencyL1(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await currencyL1.startValidatorNodeCl1();
      await waitForNode(
        currencyL1.currentNode,
        this.layer,
        'ReadyToJoin',
        this.logger,
      );
      await currencyL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === 'dl1') {
      const dataL1 = new DataL1(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.logger,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
      );
      await dataL1.startValidatorNodeDl1();
      await waitForNode(
        dataL1.currentNode,
        this.layer,
        'ReadyToJoin',
        this.logger,
      );
      await dataL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }
  }
}
