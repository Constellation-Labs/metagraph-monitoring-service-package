export type NetworkNames = 'mainnet' | 'integrationnet' | 'testnet';
export type AvailableLayers = 'ml0' | 'cl1' | 'dl1';
export const Layers: Record<string, AvailableLayers> = {
  ML0: 'ml0',
  CL1: 'cl1',
  DL1: 'dl1',
};
export const NodeStatuses: Record<string, string> = {
  READY_TO_JOIN: 'ReadyToJoin',
  READY: 'Ready',
};
