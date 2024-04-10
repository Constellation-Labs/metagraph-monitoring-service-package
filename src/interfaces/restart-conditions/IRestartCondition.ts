import { NetworkNode } from '@interfaces/services/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/IMetagraphService';
import ISeedlistService from '@interfaces/services/ISeedlistService';
import ISshService from '@interfaces/services/ISshService';
import { LogsNames } from '@utils/get-logs-names';

export default interface IRestartCondition {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  seedlistService: ISeedlistService;
  referenceSourceNode: NetworkNode;
  logsNames: LogsNames;

  shouldRestart(): Promise<boolean>;
  triggerRestart(): Promise<void>;
}
