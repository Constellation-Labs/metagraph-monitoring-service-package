import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfigs } from 'src';

import { FullMetagraph } from '../groups/FullMetagraph';

export default class ForceMetagraphRestart implements IRestartCondition {
  name = 'Force Metagraph Restart';
  config: MonitoringConfigs;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  constructor(
    config: MonitoringConfigs,
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetwokService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
  ) {
    this.config = config;
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetwokService = globalNetwokService;
    this.seedlistService = seedlistService;
    this.logger = logger;
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    return new Promise((resolve) =>
      resolve({
        shouldRestart: false,
        restartType: 'Full metagraph',
      }),
    );
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.config,
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.globalNetwokService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
