import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

export default class NoAlertsService implements IAlertService {
  loggerService: ILoggerService;
  config: Config;

  constructor(configuration: MonitoringConfiguration) {
    this.loggerService = configuration.loggerService;
    this.config = configuration.config;
  }

  private customLog(message: string) {
    this.loggerService.info(`[NoAlertsService] ${message}`);
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

  async createInformativeAlert(): Promise<void> {
    this.customLog(`No alerts`);
  }

  async unhealthyCloudInstanceAlert(): Promise<void> {
    this.customLog(`No alerts`);
  }
}
