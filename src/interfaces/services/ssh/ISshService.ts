import ILoggerService from '../logger/ILoggerService';
import { MetagraphNode } from '../metagraph/IMetagraphService';

export default interface ISshService {
  connection: unknown;
  nodeNumber: number;
  metagraphNode: MetagraphNode;
  logger: ILoggerService;

  setConnection(): Promise<void>;
  executeCommand(command: string): Promise<string>;
}
