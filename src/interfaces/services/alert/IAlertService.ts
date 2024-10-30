import { Config } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export type AlertType = 'RestartStarted' | 'RestartFailed';

export default interface IAlertService {
  loggerService: ILoggerService;
  config: Config;

  createRestartStarted(
    restartType: string,
    restartReason: string,
    lastMetagraphSnapshotOrdinal?: number,
  ): Promise<void>;
  createRestartFailed(failedReason: string): Promise<void>;
  closeAlert(alertType: AlertType): Promise<void>;
}
