import { LogLevel, NodeHealth } from '../types';

export type PollCompletedEvent = {
  type: 'PollCompleted';
  timestamp: string;
  metagraphHealthy: boolean;
  restartTriggered: boolean;
  conditionName?: string;
};

export type RestartTriggeredEvent = {
  type: 'RestartTriggered';
  timestamp: string;
  restartType: string;
  conditionName: string;
};

export type AlertRaisedEvent = {
  type: 'AlertRaised';
  timestamp: string;
  alertType: string;
  severity: string;
  message: string;
};

export type AlertClosedEvent = {
  type: 'AlertClosed';
  timestamp: string;
  alertType: string;
};

export type NodeStatusChangedEvent = {
  type: 'NodeStatusChanged';
  timestamp: string;
  nodeIp: string;
  previousStatus: NodeHealth;
  newStatus: NodeHealth;
};

export type LogEntryEvent = {
  type: 'LogEntry';
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  context?: string;
};

export type MonitoringEvent =
  | PollCompletedEvent
  | RestartTriggeredEvent
  | AlertRaisedEvent
  | AlertClosedEvent
  | NodeStatusChangedEvent
  | LogEntryEvent;
