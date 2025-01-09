import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config } from 'src/MonitoringConfiguration';

export type ShouldAlertInfo = {
  shouldAlert: boolean;
  message?: string;
  alertName?: string;
};

export default interface IAlertCondition {
  name: string;
  config: Config;
  sshServices: ISshService[];
  loggerService: ILoggerService;
  alertService: IAlertService;
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

  shouldAlert(): Promise<ShouldAlertInfo>;
  triggerAlert(message: string): Promise<void>;
}
