import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';

export class NoAlertsService implements IAlertService {
  logger: ILoggerService;

  constructor(logger: ILoggerService) {
    this.logger = logger;
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
