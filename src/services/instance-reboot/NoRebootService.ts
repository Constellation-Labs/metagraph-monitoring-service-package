import { IInstanceRebootService } from '@interfaces/index';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class NoRebootService implements IInstanceRebootService {
  name = 'No Reboot';
  loggerService: ILoggerService;
  private logger: Logger;
  config: Config;
  sshServices: ISshService[];

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'NoReboot');
  }

  async rebootInstance(): Promise<void> {
    this.logger.info('No reboot');
  }
}
