import { Configs } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export type AlertType = 'RestartStarted' | 'RestartFailed';

export default interface IAlertService {
  logger: ILoggerService;
  config: Configs;

  createRestartStarted(
    restartType: string,
    restartReason: string,
  ): Promise<void>;
  createRestartFailed(failedReason: string): Promise<void>;
  closeAlert(alertType: AlertType): Promise<void>;
}
