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

  getLatestGlobalSnapshotOfNetwork(): Promise<GlobalSnapshotInfo>;
  checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean>;
  getReferenceSourceNode(): Promise<NetworkNode | null>;
}
