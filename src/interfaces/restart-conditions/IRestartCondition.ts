import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config } from 'src/MonitoringConfiguration';

export type ShouldRestartInfo = {
  shouldRestart: boolean;
  restartType: string;
};
export default interface IRestartCondition {
  name: string;
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  loggerService: ILoggerService;

  shouldRestart(): Promise<ShouldRestartInfo>;
  triggerRestart(): Promise<void>;
}
