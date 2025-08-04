import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config } from 'src/MonitoringConfiguration';

export type ShouldRebootInfo = {
  shouldRestart: boolean;
  restartType?: string;
};
export default interface IInstanceReboot {
  name: string;
  config: Config;
  sshServices: ISshService[];
  loggerService: ILoggerService;

  rebootInstance(instanceId: string): Promise<void>;
}
