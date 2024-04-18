import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MonitoringConfiguration, Configs } from 'src/MonitoringConfiguration';

export default class NoAlertsService implements IAlertService {
  logger: ILoggerService;
  config: Configs;

  constructor(configuration: MonitoringConfiguration) {
    this.logger = configuration.logger;
    this.config = configuration.configs;
  }

  private customLog(message: string) {
    this.logger.info(`[NoAlertsService] ${message}`);
  }

  async createRestartStarted(): Promise<void> {
    this.customLog(`No alerts`);
  }

  async createRestartFailed(): Promise<void> {
    this.customLog(`No alerts`);
  }

  async closeAlert(): Promise<void> {
    this.customLog(`No alerts`);
  }
}
