import IAlertCondition from '@interfaces/alert-conditions/IAlertCondition';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';

export default class Monitor {
  public monitoringConfiguration: MonitoringConfiguration;
  public config: Config;
  public sshServices: ISshService[];
  public metagraphService: IMetagraphService;
  public globalNetworkService: IGlobalNetworkService;
  public seedlistService: ISeedlistService;
  public loggerService: ILoggerService;
  public alertService: IAlertService;
  public restartConditions: IRestartCondition[];
  public alertConditions: IAlertCondition[];

  public forceRestart: boolean;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    forceRestart: boolean,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.loggerService = monitoringConfiguration.loggerService;
    this.alertService = monitoringConfiguration.alertService;
    this.forceRestart = forceRestart;
    this.restartConditions = monitoringConfiguration.getRestartConditions();
    this.alertConditions = monitoringConfiguration.getAlertConditions();
  }

  private async closeRemoteAlerts() {
    await this.alertService.closeAlert('RestartStarted');
    await this.alertService.closeAlert('RestartFailed');
  }

  async execute() {
    try {
      this.loggerService.info(
        `##################### STARTING CHECK METAGRAPH HEALTH #####################`,
      );

      this.loggerService.info(
        'Getting valid global network reference source node',
      );
      await this.globalNetworkService.setReferenceSourceNode();

      this.loggerService.info('Getting last metagraph snapshot info');
      await this.metagraphService.setLastMetagraphInfo();
      this.loggerService.info(
        `Last metagraph snapshot info: ${JSON.stringify(this.metagraphService.metagraphSnapshotInfo)}`,
      );

      if (this.forceRestart) {
        this.loggerService.info(
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

      this.loggerService.info(`Checking conditions to metagraph restart`);
      for (const restartCondition of this.restartConditions) {
        try {
          const shoulRestartInfo = await restartCondition.shouldRestart();
          if (shoulRestartInfo.shouldRestart) {
            await this.alertService.createRestartStarted(
              shoulRestartInfo.restartType,
              restartCondition.name,
              shoulRestartInfo.lastMetagraphSnapshotOrdinal,
            );

            this.loggerService.info(
              `Condition ${restartCondition.name} detected, triggering restart...`,
            );

            await restartCondition.triggerRestart();
            await this.closeRemoteAlerts();
            return;
          }
        } catch (e) {
          this.loggerService.warn(
            `Could not get restart condition: ${restartCondition}, skipping`,
          );
          continue;
        }
      }

      this.loggerService.info(`Checking conditions to informative alert`);
      for (const alertCondition of this.alertConditions) {
        try {
          const shouldAlertInfo = await alertCondition.shouldAlert();
          if (shouldAlertInfo.shouldAlert) {
            await alertCondition.triggerAlert(shouldAlertInfo.message || '');

            this.loggerService.info(
              `Condition ${alertCondition.name} detected, triggering alert...`,
            );

            return;
          }
        } catch (e) {
          this.loggerService.warn(
            `Could not get alert condition: ${alertCondition}, skipping`,
          );
          continue;
        }
      }

      this.loggerService.info(`Metagraph is healthy`);
      await this.closeRemoteAlerts();
      return;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.loggerService.error(
          `Error when checking metagraph health: ${error.message}`,
        );
        await this.alertService.createRestartFailed(error.message);
      }
    }
  }
}
