import config from '@config/config.json';
import { NetworkNode } from '@interfaces/IGlobalNetworkService';
import IMetagraphService from '@interfaces/IMetagraphService';
import ISeedlistService from '@interfaces/ISeedlistService';
import ISshService from '@interfaces/ISshService';
import { LogsNames } from '@utils/get-logs-names';

import { FullMetagraph } from '../types/FullMetagraph';

export default class ForceMetagraphRestart {
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private seedlistService: ISeedlistService;
  private referenceSourceNode: NetworkNode;
  private logsNames: LogsNames;
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
  async shouldRestartMetagraph(): Promise<boolean> {
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
