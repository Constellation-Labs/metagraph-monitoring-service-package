export enum NodeHealth {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  FORKED = 'forked',
  UNKNOWN = 'unknown',
}

export enum MetagraphHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown',
}

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export enum OperationType {
  RESTART_FULL_METAGRAPH = 'fullMetagraph',
  RESTART_FULL_LAYER_ML0 = 'fullLayerMl0',
  RESTART_FULL_LAYER_CL1 = 'fullLayerCl1',
  RESTART_FULL_LAYER_DL1 = 'fullLayerDl1',
  RUN_CHECK = 'runCheck',
}

export enum OperationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
