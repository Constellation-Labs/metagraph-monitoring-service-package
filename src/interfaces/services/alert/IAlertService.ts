import ILoggerService from '../logger/ILoggerService';

export type AlertType = 'RestartStarted' | 'RestartFailed';

export default interface IAlertService {
  logger: ILoggerService;

  createRestartStarted(
    restartType: string,
    restartReason: string,
  ): Promise<void>;
  createRestartFailed(failedReason: string): Promise<void>;
  closeAlert(alertType: AlertType): Promise<void>;
}