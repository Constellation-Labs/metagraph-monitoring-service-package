import { MetagraphNode } from '@interfaces/metagraph/types';

export default interface ISshService {
  connection: unknown;
  nodeNumber: number;
  metagraphNode: MetagraphNode;

  setConnection(): Promise<void>;
  executeCommand(command: string): Promise<string>;
}
