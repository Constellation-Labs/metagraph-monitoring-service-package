import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfigs } from 'src';

export type ShouldRestartInfo = {
  shouldRestart: boolean;
  restartType: string;
};
export default interface IRestartCondition {
  name: string;
  config: MonitoringConfigs;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  shouldRestart(): Promise<ShouldRestartInfo>;
  triggerRestart(): Promise<void>;
}
