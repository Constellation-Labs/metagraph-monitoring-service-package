import { Config } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export type AlertType = 'RestartStarted' | 'RestartFailed' | 'Informative';

export default interface IAlertService {
  loggerService: ILoggerService;
  config: Config;

  createRestartStarted(
    restartType: string,
    restartReason: string,
    lastMetagraphSnapshotOrdinal?: number,
  ): Promise<void>;
  createRestartFailed(failedReason: string): Promise<void>;
  closeAlert(alertType: AlertType, alertName?: string): Promise<void>;
  createInformativeAlert(
    message: string,
    alertName: string,
    alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
  ): Promise<void>;
}
