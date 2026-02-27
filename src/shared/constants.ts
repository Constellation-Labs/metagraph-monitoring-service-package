export type NetworkNames = 'mainnet' | 'integrationnet' | 'testnet';

export const Layers = {
  ML0: 'ml0',
  CL1: 'cl1',
  DL1: 'dl1',
} as const;

export type AvailableLayers = (typeof Layers)[keyof typeof Layers];

export const NodeStatuses = {
  READY_TO_JOIN: 'ReadyToJoin',
  DOWNLOAD_IN_PROGRESS: 'DownloadInProgress',
  OBSERVING: 'Observing',
  WAITING_FOR_READY: 'WaitingForReady',
  READY: 'Ready',
} as const;

export type NodeStatus = (typeof NodeStatuses)[keyof typeof NodeStatuses];
