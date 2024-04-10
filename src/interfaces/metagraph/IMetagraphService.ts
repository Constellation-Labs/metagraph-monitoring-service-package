import {
  MetagraphNode,
  MetagraphNodeInfo,
  MetagraphSnapshotInfo,
} from './types';

export default interface IMetagraphService {
  metagraphId: string;
  nodes: MetagraphNode[];
  networName: string;

  getLastMetagraphInfo(): Promise<MetagraphSnapshotInfo>;
  getNodeInfo(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphNodeInfo | null>;
  checkIfNodeIsHealthy(nodeIp: string, nodePort: number): Promise<boolean>;
}
