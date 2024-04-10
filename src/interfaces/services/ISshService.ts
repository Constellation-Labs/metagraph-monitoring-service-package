import { MetagraphNode } from './IMetagraphService';

export default interface ISshService {
  connection: unknown;
  nodeNumber: number;
  metagraphNode: MetagraphNode;

  setConnection(): Promise<void>;
  executeCommand(command: string): Promise<string>;
}
