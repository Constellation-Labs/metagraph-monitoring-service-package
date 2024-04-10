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
