import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

export default interface IRestartCondition {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  shouldRestart(): Promise<boolean>;
  triggerRestart(): Promise<void>;
}
