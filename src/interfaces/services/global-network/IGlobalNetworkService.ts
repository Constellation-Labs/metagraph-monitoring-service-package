import ILoggerService from '../logger/ILoggerService';

export type NetworkNode = {
  ip: string;
  id: string;
  port: number;
};

export type GlobalSnapshotInfo = {
  lastSnapshotOrdinal: number;
  lastSnapshotHash: string;
};

export default interface IGlobalNetworkService {
  name: string;
  nodes: NetworkNode[];
  beUrl: string;
  referenceSourceNode: NetworkNode;
  logger: ILoggerService;

  getLatestGlobalSnapshotOfNetwork(): Promise<GlobalSnapshotInfo>;
  checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean>;
  setReferenceSourceNode(): Promise<void>;
}
