import config from '@config/config.json';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import conditions from '@jobs/check-metagraph-health/restart/conditions';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';

export default class CheckMetagraphHealth {
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private globalNetworkService: IGlobalNetworkService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;

  private forceRestart: boolean;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetworkService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    forceRestart: boolean,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetworkService = globalNetworkService;
    this.seedlistService = seedlistService;
    this.logger = logger;
    this.forceRestart = forceRestart;
  }

  async execute() {
    this.logger.info(
      `##################### STARTING CHECK METAGRAPH HEALTH #####################`,
    );

    this.logger.info('Getting valid global network reference source node');
    await this.globalNetworkService.setReferenceSourceNode();

    this.logger.info('Getting last metagraph snapshot info');
    await this.metagraphService.setLastMetagraphInfo();

    if (this.forceRestart) {
      this.logger.info(
        'Force restart provided, starting the complete restart of metagraph',
      );
      return await new ForceMetagraphRestart(
        this.sshServices,
        this.metagraphService,
        this.globalNetworkService,
        this.seedlistService,
        this.logger,
      ).triggerRestart();
    }

    this.logger.info(`Checking conditions to metagraph restart`);
    for (const restartCondition of config.metagraph.restart_conditions) {
      try {
        const RestartCondition = conditions[restartCondition];
        const iRestartCondition: IRestartCondition = new RestartCondition(
          this.sshServices,
          this.metagraphService,
          this.globalNetworkService,
          this.seedlistService,
          this.logger,
        );

        if (await iRestartCondition.shouldRestart()) {
          this.logger.info(
            `Condition ${restartCondition} detected, triggering restart...`,
          );
          await iRestartCondition.triggerRestart();
          return;
        }
      } catch (e) {
        this.logger.warn(
          `Could not get restart condition: ${restartCondition}, skipping`,
        );
        continue;
      }
    }
  }
}
