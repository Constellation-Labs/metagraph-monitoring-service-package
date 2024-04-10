import config from '@config/config.json';
import { NetworkNode } from '@interfaces/services/IGlobalNetworkService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/IMetagraphService';
import ISeedlistService from '@interfaces/services/ISeedlistService';
import ISshService from '@interfaces/services/ISshService';
import { Layers } from '@shared/constants';
import { LogsNames } from '@utils/get-logs-names';

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

  private referenceMetagraphNode: MetagraphNode;
  private referenceSourceNode: NetworkNode;
  private layer: Layers;
  private logsNames: LogsNames;
  constructor(
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceMetagraphNode: MetagraphNode,
    referenceSourceNode: NetworkNode,
    layer: Layers,
    logsNames: LogsNames,
  ) {
    this.sshService = sshService;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.referenceMetagraphNode = referenceMetagraphNode;
    this.referenceSourceNode = referenceSourceNode;
    this.layer = layer;
    this.logsNames = logsNames;
  }

  private async killProcess() {
    await killCurrentExecution(
      this.sshService,
      config.metagraph.layers[this.layer].ports.public,
    );
  }

  private async moveLog() {
    await saveCurrentLogs(this.sshService, this.layer, this.logsNames);
  }

  async performRestart() {
    await this.killProcess();
    await this.moveLog();

    if (this.layer === 'ml0') {
      const metagraphL0 = new MetagraphL0(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.referenceSourceNode,
        this.logsNames.ml0LogName,
      );
      await metagraphL0.startValidatorNodeL0();
      await waitForNode(metagraphL0.metagraphNode, this.layer, 'ReadyToJoin');
      await metagraphL0.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === 'cl1') {
      const currencyL1 = new CurrencyL1(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
        this.logsNames.ml0LogName,
      );
      await currencyL1.startValidatorNodeCl1();
      await waitForNode(currencyL1.metagraphNode, this.layer, 'ReadyToJoin');
      await currencyL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }

    if (this.layer === 'dl1') {
      const dataL1 = new DataL1(
        this.sshService,
        this.metagraphService,
        this.seedlistService,
        this.referenceMetagraphNode,
        this.referenceSourceNode,
        this.logsNames.ml0LogName,
      );
      await dataL1.startValidatorNodeDl1();
      await waitForNode(dataL1.metagraphNode, this.layer, 'ReadyToJoin');
      await dataL1.joinNodeToCluster(this.referenceMetagraphNode);
      return;
    }
  }
}
