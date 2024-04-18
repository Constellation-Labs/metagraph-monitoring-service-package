import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfiguration, Configs } from 'src/MonitoringConfiguration';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';

export default class CheckMetagraphHealth {
  public monitoringConfiguration: MonitoringConfiguration;
  public config: Configs;
  public sshServices: ISshService[];
  public metagraphService: IMetagraphService;
  public globalNetworkService: IGlobalNetworkService;
  public seedlistService: ISeedlistService;
  public logger: ILoggerService;
  public alertService: IAlertService;
  public restartConditions: IRestartCondition[];

  public forceRestart: boolean;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    forceRestart: boolean,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.configs;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.logger = monitoringConfiguration.logger;
    this.alertService = monitoringConfiguration.alertService;
    this.forceRestart = forceRestart;
    this.restartConditions = monitoringConfiguration.restartConditions;
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
          this.monitoringConfiguration,
        ).triggerRestart();

        await this.closeRemoteAlerts();

        return;
      }

      this.logger.info(`Checking conditions to metagraph restart`);
      for (const restartCondition of this.restartConditions) {
        try {
          const shoulRestartInfo = await restartCondition.shouldRestart();
          if (shoulRestartInfo.shouldRestart) {
            await this.alertService.createRestartStarted(
              shoulRestartInfo.restartType,
              restartCondition.name,
            );

            this.logger.info(
              `Condition ${restartCondition.name} detected, triggering restart...`,
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
