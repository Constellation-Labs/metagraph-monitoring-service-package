import { Configs } from 'src/MonitoringConfiguration';

import ILoggerService from '../logger/ILoggerService';

export type MetagraphNode = {
  ip: string;
  username: string;
  privateKeyPath: string;
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
};

export type MetagraphNodeInfo = {
  state: string;
  id: string;
  host: string;
  publicPort: number;
  p2pPort: number;
};

export default interface IMetagraphService {
  config: Configs;
  metagraphId: string;
  nodes: MetagraphNode[];
  networName: string;
  logger: ILoggerService;
  metagraphSnapshotInfo: MetagraphSnapshotInfo;

  setLastMetagraphInfo(): Promise<void>;
  getNodeInfo(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphNodeInfo | null>;
  checkIfNodeIsHealthy(nodeIp: string, nodePort: number): Promise<boolean>;
}
