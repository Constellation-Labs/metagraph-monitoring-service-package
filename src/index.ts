import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import INotificationService from '@interfaces/services/notification/INotificationService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import Monitor from './monitor/Monitor';
import { MonitoringConfiguration, Config } from './MonitoringConfiguration';

export default class MonitoringApp {
  public configuration: MonitoringConfiguration;
  public forceRestart: boolean;
  public notificationMessage?: string;

  constructor(
    config: Config,
    forceRestart: boolean = false,
    devMode: boolean = false,
    services?: {
      loggerService?: ILoggerService;
      sshServices?: ISshService[];
      metagraphService?: IMetagraphService;
      globalNetworkService?: IGlobalNetworkService;
      seedlistService?: ISeedlistService;
      allowanceListService?: IAllowanceListService;
      alertService?: IAlertService;
      notificationService?: INotificationService;
    },
    customRestartConditions?: IRestartCondition[],
    notificationMessage?: string,
  ) {
    this.configuration = new MonitoringConfiguration(
      config,
      devMode,
      services,
      customRestartConditions,
    );
    this.forceRestart = forceRestart;
    this.notificationMessage = notificationMessage;
  }

  private async initializeSshConnections() {
    await Promise.all(
      this.configuration.sshServices.map((sshService) =>
        sshService.setConnection(),
      ),
    );
  }

  private async finishSshConnections() {
    await Promise.all(
      this.configuration.sshServices.map((sshService) =>
        sshService.destroyConnection(),
      ),
    );
  }

  public async checkMetagraphHealthOnce(): Promise<void> {
    try {
      try {
        await this.initializeSshConnections();
      } catch (e) {
        const message = `Could not establish connection with node(s). Error: ${JSON.stringify(e)}`;
        this.configuration.alertService.createRestartFailed(message);
        this.configuration.loggerService.warn(message);
        return;
      }

      const monitor = new Monitor(this.configuration, this.forceRestart);
      if (this.notificationMessage?.trim()) {
        await monitor.executeWithNotification(this.notificationMessage || '');
      } else {
        await monitor.execute();
      }
    } catch (e) {
      this.configuration.loggerService.error(
        `Error while executing checkMetagraphHealth: ${JSON.stringify(e)}`,
      );
    } finally {
      try {
        await this.finishSshConnections();
      } catch (e) {
        this.configuration.loggerService.warn(
          `Error while closing SSH connections: ${JSON.stringify(e)}`,
        );
      }
    }
  }

  public async checkMetagraphHealth() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.checkMetagraphHealthOnce();
        this.forceRestart = false;
        this.notificationMessage = undefined;
      } catch (error) {
        this.configuration.loggerService.error(
          `Error when checkMetagraphHealth: ${error}`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          this.configuration.config.check_healthy_interval_in_minutes *
            60 *
            1000,
        ),
      );
    }
  }
}
