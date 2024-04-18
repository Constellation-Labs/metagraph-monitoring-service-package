import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import Monitor from './monitor/Monitor';
import { MonitoringConfiguration, Config } from './MonitoringConfiguration';

export default class MonitoringApp {
  public configuration: MonitoringConfiguration;
  public forceRestart: boolean;

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
      alertService?: IAlertService;
    },
    customRestartConditions?: IRestartCondition[],
  ) {
    this.configuration = new MonitoringConfiguration(
      config,
      devMode,
      services,
      customRestartConditions,
    );
    this.forceRestart = forceRestart;
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

  public setForceRestart(value: boolean) {
    this.forceRestart = value;
  }

  public async checkMetagraphHealthOnce() {
    try {
      await this.initializeSshConnections();
      const monitor = new Monitor(this.configuration, this.forceRestart);
      await monitor.execute();
    } catch (e) {
      this.configuration.loggerService.error(
        `Error when executing checkMetagraphHealth: ${e}`,
      );
    } finally {
      await this.finishSshConnections();
    }
  }

  public async checkMetagraphHealth() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.checkMetagraphHealthOnce();
        this.forceRestart = false;
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
