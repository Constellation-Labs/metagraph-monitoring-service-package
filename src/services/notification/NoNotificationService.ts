import ILoggerService from '@interfaces/services/logger/ILoggerService';
import INotificationService from '@interfaces/services/notification/INotificationService';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

export default class NoNotificationService implements INotificationService {
  loggerService: ILoggerService;
  config: Config;

  constructor(configuration: MonitoringConfiguration) {
    this.loggerService = configuration.loggerService;
    this.config = configuration.config;
  }

  private customLog(message: string) {
    this.loggerService.info(`[NoNotificationService] ${message}`);
  }

  async notifyUsers(): Promise<void> {
    this.customLog(`No alerts`);
  }
}
