import config from '@config/config.json';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import { NetworkNode } from '@interfaces/services/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/IMetagraphService';
import ISeedlistService from '@interfaces/services/ISeedlistService';
import ISshService from '@interfaces/services/ISshService';
import { LogsNames } from '@utils/get-logs-names';

import { FullMetagraph } from '../types/FullMetagraph';

export default class ForceMetagraphRestart implements IRestartCondition {
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

  async shouldRestart(): Promise<boolean> {
    return new Promise((resolve) => resolve(config.force_metagraph_restart));
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.referenceSourceNode,
      this.logsNames,
    );

    await fullMetagraph.performRestart();
  }
}
