import ILoggerService from '../logger/ILoggerService';
import { MetagraphNode } from '../metagraph/IMetagraphService';

export default interface ISshService {
  connection: unknown;
  nodeNumber: number;
  metagraphNode: MetagraphNode;
  loggerService: ILoggerService;

  setConnection(): Promise<void>;
  executeCommand(
    command: string,
    ignoreErrors?: boolean,
    timeoutMs?: number,
  ): Promise<string>;
  destroyConnection(): Promise<void>;
}
