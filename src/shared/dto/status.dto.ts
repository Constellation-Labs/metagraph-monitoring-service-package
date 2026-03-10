export class MetagraphStatusDto {
  metagraphId: string;
  metagraphName: string;
  overallHealth: string;
  lastPollTime: string | null;
  nextPollTime: string | null;
  lastSnapshotOrdinal: number | null;
  lastSnapshotHash: string | null;
  ownerAddress: string | null;
  activeAlerts: string[];
  nodeCount: number;
  healthyNodeCount: number;
  monitoringLoopRunning: boolean;
  uptimeSeconds: number;
  pollCount: number;
  restartCount: number;
}
