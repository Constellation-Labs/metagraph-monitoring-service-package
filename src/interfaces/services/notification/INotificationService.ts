import { Config } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export default interface INotificationService {
  loggerService: ILoggerService;
  config: Config;

  notifyUsers(message: string): Promise<void>;
}
