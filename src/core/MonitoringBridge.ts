import { EventEmitter } from 'events';

import { IndividualNode } from './monitor/restart/groups/IndividualNode';
import { MonitoringConfiguration, Config } from './MonitoringConfiguration';
import { MonitoringLoggerAdapter } from './MonitoringLoggerAdapter';
import { AvailableLayers } from './shared/constants';
import {
  MonitoringEvent,
  PollCompletedEvent,
} from '../shared/events/monitoring-event';
import { MetagraphHealth, NodeHealth } from '../shared/types';

import MonitoringApp from './index';

export type MonitoringState = {
  metagraphId: string;
  metagraphName: string;
  overallHealth: MetagraphHealth;
  lastPollTime: string | null;
  nextPollTime: string | null;
  lastSnapshotOrdinal: number | null;
  lastSnapshotHash: string | null;
  ownerAddress: string | null;
  activeAlerts: string[];
  nodes: MonitoringNodeState[];
  loopRunning: boolean;
  pollCount: number;
  restartCount: number;
  startedAt: string;
};

export type MonitoringNodeState = {
  ip: string;
  instanceId: string | null;
  ml0Health: NodeHealth;
  cl1Health: NodeHealth;
  dl1Health: NodeHealth;
  ml0Port: number;
  cl1Port: number;
  dl1Port: number;
  sshUsername: string;
};

export class MonitoringBridge {
  private app: MonitoringApp;
  private config: Config;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isPollInProgress = false;
  public readonly events: EventEmitter;
  public readonly loggerAdapter: MonitoringLoggerAdapter;

  private state: MonitoringState;

  constructor(app: MonitoringApp, loggerAdapter: MonitoringLoggerAdapter) {
    this.app = app;
    this.config = app.configuration.config;
    this.loggerAdapter = loggerAdapter;
    this.events = new EventEmitter();
    this.events.setMaxListeners(50);

    const metagraph = this.config.metagraph;
    this.state = {
      metagraphId: metagraph.id,
      metagraphName: metagraph.name,
      overallHealth: MetagraphHealth.UNKNOWN,
      lastPollTime: null,
      nextPollTime: null,
      lastSnapshotOrdinal: null,
      lastSnapshotHash: null,
      ownerAddress: null,
      activeAlerts: [],
      nodes: metagraph.nodes.map((node) => ({
        ip: node.ip,
        instanceId: (node as { instance_id?: string }).instance_id ?? null,
        ml0Health: NodeHealth.UNKNOWN,
        cl1Health: metagraph.layers.cl1.ignore_layer
          ? NodeHealth.UNKNOWN
          : NodeHealth.UNKNOWN,
        dl1Health: metagraph.layers.dl1.ignore_layer
          ? NodeHealth.UNKNOWN
          : NodeHealth.UNKNOWN,
        ml0Port: metagraph.layers.ml0.ports.public,
        cl1Port: metagraph.layers.cl1.ports.public,
        dl1Port: metagraph.layers.dl1.ports.public,
        sshUsername: node.username,
      })),
      loopRunning: false,
      pollCount: 0,
      restartCount: 0,
      startedAt: new Date().toISOString(),
    };
  }

  getState(): MonitoringState {
    return { ...this.state };
  }

  getConfiguration(): MonitoringConfiguration {
    return this.app.configuration;
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.state.loopRunning = true;

    const intervalMs =
      this.config.check_healthy_interval_in_minutes * 60 * 1000;

    this.runPoll();

    this.intervalHandle = setInterval(() => {
      this.runPoll();
    }, intervalMs);

    this.updateNextPollTime(intervalMs);
  }

  stop(): void {
    this.isRunning = false;
    this.state.loopRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async forceCheck(): Promise<void> {
    if (this.isPollInProgress) {
      throw new Error('A poll is already in progress');
    }
    await this.runPoll();
  }

  async restartNode(
    nodeIndex: number,
    layers: AvailableLayers[],
  ): Promise<void> {
    const configuration = this.app.configuration;
    const sshServices = configuration.sshServices;

    if (nodeIndex < 0 || nodeIndex >= sshServices.length) {
      throw new Error(
        `Invalid node index: ${nodeIndex}. Must be 0-${sshServices.length - 1}`,
      );
    }

    const sshService = sshServices[nodeIndex];

    await configuration.globalNetworkService.setReferenceSourceNode();
    const referenceSourceNode =
      configuration.globalNetworkService.referenceSourceNode;

    // Use first node that is NOT the one being restarted as reference metagraph node
    const otherSshService =
      sshServices.find((_, i) => i !== nodeIndex) ?? sshService;
    const referenceMetagraphNode = otherSshService.metagraphNode;

    for (const layer of layers) {
      const restart = new IndividualNode(
        configuration,
        sshService,
        referenceMetagraphNode,
        referenceSourceNode,
        layer,
      );
      await restart.performRestart();
    }

    this.state.restartCount++;
  }

  async forceRestart(): Promise<void> {
    if (this.isPollInProgress) {
      throw new Error('A poll is already in progress');
    }
    this.app.forceRestart = true;
    await this.runPoll();
    this.app.forceRestart = false;
  }

  private async updateNodeHealthStatuses(): Promise<void> {
    const metagraphService = this.app.configuration.metagraphService;
    const metagraphConfig = this.config.metagraph;
    let healthyCount = 0;

    await Promise.all(
      this.state.nodes.map(async (node) => {
        let allLayersHealthy = true;

        // ML0
        const ml0Healthy = await metagraphService.checkIfNodeIsHealthy(
          node.ip,
          node.ml0Port,
        );
        node.ml0Health = ml0Healthy ? NodeHealth.HEALTHY : NodeHealth.UNHEALTHY;
        if (!ml0Healthy) allLayersHealthy = false;

        // CL1
        if (!metagraphConfig.layers.cl1.ignore_layer) {
          const cl1Healthy = await metagraphService.checkIfNodeIsHealthy(
            node.ip,
            node.cl1Port,
          );
          node.cl1Health = cl1Healthy
            ? NodeHealth.HEALTHY
            : NodeHealth.UNHEALTHY;
          if (!cl1Healthy) allLayersHealthy = false;
        }

        // DL1
        if (!metagraphConfig.layers.dl1.ignore_layer) {
          const dl1Healthy = await metagraphService.checkIfNodeIsHealthy(
            node.ip,
            node.dl1Port,
          );
          node.dl1Health = dl1Healthy
            ? NodeHealth.HEALTHY
            : NodeHealth.UNHEALTHY;
          if (!dl1Healthy) allLayersHealthy = false;
        }

        if (allLayersHealthy) {
          healthyCount++;
        }
      }),
    );

    // Update snapshot info
    try {
      await metagraphService.setLastMetagraphInfo();
      const snapInfo = metagraphService.metagraphSnapshotInfo;
      this.state.lastSnapshotOrdinal = snapInfo.lastSnapshotOrdinal;
      this.state.lastSnapshotHash = snapInfo.lastSnapshotHash;
      this.state.ownerAddress = snapInfo.ownerAddress;
    } catch {
      // Block explorer may be unreachable — keep previous values
    }

    // Determine overall health
    if (healthyCount === this.state.nodes.length) {
      this.state.overallHealth = MetagraphHealth.HEALTHY;
    } else if (healthyCount > 0) {
      this.state.overallHealth = MetagraphHealth.DEGRADED;
    } else {
      this.state.overallHealth = MetagraphHealth.CRITICAL;
    }
  }

  private async runPoll(): Promise<void> {
    if (this.isPollInProgress) return;
    this.isPollInProgress = true;

    const pollStart = new Date().toISOString();

    try {
      const wasForceRestart = this.app.forceRestart;
      await this.app.checkMetagraphHealthOnce();
      this.state.lastPollTime = pollStart;
      this.state.pollCount++;

      if (wasForceRestart) {
        this.state.restartCount++;
      }

      await this.updateNodeHealthStatuses();

      const event: PollCompletedEvent = {
        type: 'PollCompleted',
        timestamp: pollStart,
        metagraphHealthy: this.state.overallHealth === MetagraphHealth.HEALTHY,
        restartTriggered: wasForceRestart,
      };
      this.events.emit('monitoring', event);
    } catch (e) {
      try {
        await this.updateNodeHealthStatuses();
      } catch {
        this.state.overallHealth = MetagraphHealth.DEGRADED;
      }

      const event: PollCompletedEvent = {
        type: 'PollCompleted',
        timestamp: pollStart,
        metagraphHealthy: false,
        restartTriggered: false,
      };
      this.events.emit('monitoring', event);
    } finally {
      this.isPollInProgress = false;

      if (this.isRunning && this.intervalHandle) {
        const intervalMs =
          this.config.check_healthy_interval_in_minutes * 60 * 1000;
        this.updateNextPollTime(intervalMs);
      }
    }
  }

  private updateNextPollTime(intervalMs: number): void {
    this.state.nextPollTime = new Date(Date.now() + intervalMs).toISOString();
  }

  private emitEvent(event: MonitoringEvent): void {
    this.events.emit('monitoring', event);
  }
}
