export type NetworkNode = {
  ip: string;
  id: string;
  port: number;
};

export type GlobalSnapshotInfo = {
  lastSnapshotOrdinal: number;
  lastSnapshotHash: string;
};
