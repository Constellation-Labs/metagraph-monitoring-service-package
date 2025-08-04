import { Config } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export type MetagraphNode = {
  ip: string;
  username: string;
  password?: string;
  privateKeyPath: string;
  privateKeyPassword?: string;
  instance_id?: string;
  key_file: {
    name: string;
    alias: string;
    password: string;
  };
};

export type MetagraphSnapshotInfo = {
  lastSnapshotTimestamp: number;
  lastSnapshotOrdinal: number;
  lastSnapshotHash: string;
  ownerAddress: string;
};

export type MetagraphNodeInfo = {
  state: string;
  id: string;
  host: string;
  publicPort: number;
  p2pPort: number;
};

export type MetagraphClusterInfo = {
  state: string;
  id: string;
  ip: string;
  publicPort: number;
  p2pPort: number;
};

export default interface IMetagraphService {
  config: Config;
  metagraphId: string;
  nodes: MetagraphNode[];
  networkName: string;
  loggerService: ILoggerService;
  metagraphSnapshotInfo: MetagraphSnapshotInfo;

  setLastMetagraphInfo(): Promise<void>;
  getNodeInfo(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphNodeInfo | null>;
  checkIfNodeIsHealthy(nodeIp: string, nodePort: number): Promise<boolean>;

  getL0ForkedNodes(nodes: MetagraphNode[]): Promise<MetagraphNode[]>;
  getNodeClusterPOV(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphClusterInfo[]>;
}
