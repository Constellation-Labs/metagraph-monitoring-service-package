import { GlobalSnapshotInfo, NetworkNode } from './types';

export default interface IGlobalNetworkService {
  name: string;
  nodes: NetworkNode[];
  beUrl: string;

  getLatestGlobalSnapshotOfNetwork(): Promise<GlobalSnapshotInfo>;
  checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean>;
  getReferenceSourceNode(): Promise<NetworkNode | null>;
}
