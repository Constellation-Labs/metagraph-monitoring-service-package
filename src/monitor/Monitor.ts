import IAlertCondition from '@interfaces/alert-conditions/IAlertCondition';
import { IInstanceRebootService } from '@interfaces/index';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';
import { Logger } from '../utils/logger';

export default class Monitor {
  public monitoringConfiguration: MonitoringConfiguration;
  public restartConditions: IRestartCondition[];
  public alertConditions: IAlertCondition[];
  public instanceReboot: IInstanceRebootService;
  public forceRestart: boolean;

  private logger: Logger;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    forceRestart: boolean,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.forceRestart = forceRestart;
    this.restartConditions = monitoringConfiguration.getRestartConditions();
    this.alertConditions = monitoringConfiguration.getAlertConditions();
    this.instanceReboot = monitoringConfiguration.getInstanceReboot();
    this.logger = new Logger(monitoringConfiguration.loggerService, 'Monitor');
  }

  private async closeRemoteAlerts() {
    const { alertService } = this.monitoringConfiguration;
    await alertService.closeAlert('RestartStarted');
    await alertService.closeAlert('RestartFailed');
    await alertService.closeAlert('UnhealthyInstances');
  }

  async execute() {
    const { metagraphService, globalNetworkService, alertService } =
      this.monitoringConfiguration;

    try {
      this.logger.info('Health check started');

      this.logger.info('Resolving global network reference node');
      await globalNetworkService.setReferenceSourceNode();

      this.logger.info('Fetching last metagraph snapshot');
      await metagraphService.setLastMetagraphInfo();

      if (this.forceRestart) {
        this.logger.info(
          'Force restart provided, triggering full metagraph restart',
        );

        await alertService.createRestartStarted(
          'ForceMetagraphRestart',
          'ForceMetagraphRestart',
        );

        await new ForceMetagraphRestart(
          this.monitoringConfiguration,
        ).triggerRestart();

        await this.closeRemoteAlerts();

        return;
      }

      this.logger.info('Checking restart conditions');
      for (const restartCondition of this.restartConditions) {
        try {
          const shouldRestartInfo = await restartCondition.shouldRestart();
          if (shouldRestartInfo.shouldRestart) {
            await alertService.createRestartStarted(
              shouldRestartInfo.restartType,
              restartCondition.name,
              shouldRestartInfo.lastMetagraphSnapshotOrdinal,
            );

            this.logger.warn(
              `Restart condition triggered: ${restartCondition.name}`,
            );

            await restartCondition.triggerRestart();
            await this.closeRemoteAlerts();
            return;
          }
        } catch (e) {
          this.logger.warn(
            `Failed to evaluate restart condition: ${restartCondition.name}, skipping`,
          );
          continue;
        }
      }

      this.logger.info('Checking alert conditions');
      for (const alertCondition of this.alertConditions) {
        try {
          const shouldAlertInfo = await alertCondition.shouldAlert();
          if (shouldAlertInfo.shouldAlert) {
            this.logger.warn(
              `Alert condition triggered: ${alertCondition.name}`,
            );

            await alertService.createInformativeAlert(
              shouldAlertInfo.message || '',
              shouldAlertInfo.alertName,
              shouldAlertInfo.alertPriority,
            );

            return;
          } else {
            this.logger.info(
              `Closing informative alert ${alertCondition.name}`,
            );
            await alertService.closeAlert(
              'Informative',
              shouldAlertInfo.alertName,
            );
          }
        } catch (e) {
          this.logger.warn(
            `Failed to evaluate alert condition: ${alertCondition.name}, skipping`,
          );
          continue;
        }
      }

      this.logger.info('Metagraph is healthy');
      await this.closeRemoteAlerts();
      return;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Error when checking metagraph health: ${error.message}`,
        );
        await alertService.createRestartFailed(error.message);
      }
    }
  }

  async executeWithNotification(notificationMessage: string) {
    await this.execute();
    try {
      this.logger.info('Notifying users');
      this.monitoringConfiguration.notificationService.notifyUsers(
        notificationMessage,
      );
    } catch (e) {
      this.logger.error(`Failed to notify users: ${e}`);
      throw e;
    }
  }
}
