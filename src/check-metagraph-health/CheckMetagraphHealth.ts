import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfigs } from 'src';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';

export default class CheckMetagraphHealth {
  private config: MonitoringConfigs;
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private globalNetworkService: IGlobalNetworkService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;
  private alertService: IAlertService;
  private restartConditionals: IRestartCondition[];

  private forceRestart: boolean;

  constructor(
    config: MonitoringConfigs,
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetworkService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    alertService: IAlertService,
    forceRestart: boolean,
    restartConditionals: IRestartCondition[],
  ) {
    this.config = config;
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetworkService = globalNetworkService;
    this.seedlistService = seedlistService;
    this.logger = logger;
    this.alertService = alertService;
    this.forceRestart = forceRestart;
    this.restartConditionals = restartConditionals;
  }

  private async closeRemoteAlerts() {
    await this.alertService.closeAlert('RestartStarted');
    await this.alertService.closeAlert('RestartFailed');
  }

  async execute() {
    try {
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

        await this.alertService.createRestartStarted(
          'ForceMetagraphRestart',
          'ForceMetagraphRestart ',
        );

        await new ForceMetagraphRestart(
          this.config,
          this.sshServices,
          this.metagraphService,
          this.globalNetworkService,
          this.seedlistService,
          this.logger,
        ).triggerRestart();

        await this.closeRemoteAlerts();

        return;
      }

      this.logger.info(`Checking conditions to metagraph restart`);
      for (const restartCondition of this.restartConditionals) {
        try {
          const shoulRestartInfo = await restartCondition.shouldRestart();
          if (shoulRestartInfo.shouldRestart) {
            await this.alertService.createRestartStarted(
              shoulRestartInfo.restartType,
              restartCondition.name,
            );

            this.logger.info(
              `Condition ${restartCondition} detected, triggering restart...`,
            );

            await restartCondition.triggerRestart();
            await this.closeRemoteAlerts();
            return;
          }
        } catch (e) {
          this.logger.warn(
            `Could not get restart condition: ${restartCondition}, skipping`,
          );
          continue;
        }
      }

      this.logger.info(`Metagraph is healthy`);
      await this.closeRemoteAlerts();
      return;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Error when checking metagraph health: ${error.message}`,
        );
        await this.alertService.createRestartFailed(error.message);
      }
    }
  }
}
