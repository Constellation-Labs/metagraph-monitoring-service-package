import config from '@config/config.json';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import { FullMetagraph } from '../types/FullMetagraph';

export default class ForceMetagraphRestart implements IRestartCondition {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetwokService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetwokService = globalNetwokService;
    this.seedlistService = seedlistService;
    this.logger = logger;
  }

  async shouldRestart(): Promise<boolean> {
    return new Promise((resolve) => resolve(config.force_metagraph_restart));
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.globalNetwokService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
