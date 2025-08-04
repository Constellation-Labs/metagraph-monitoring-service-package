import { IInstanceRebootService } from '@interfaces/index';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

export default class NoRebootService implements IInstanceRebootService {
  name = 'No Reboot';
  loggerService: ILoggerService;
  config: Config;
  sshServices: ISshService[];

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[NoRebootService] ${message}`);
  }

  async rebootInstance(): Promise<void> {
    this.customLogger('No reboot');
  }
}
