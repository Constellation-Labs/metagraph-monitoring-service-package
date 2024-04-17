import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MonitoringConfigs } from 'src';

export class NoAlertsService implements IAlertService {
  logger: ILoggerService;
  config: MonitoringConfigs;

  constructor(logger: ILoggerService, config: MonitoringConfigs) {
    this.logger = logger;
    this.config = config;
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
