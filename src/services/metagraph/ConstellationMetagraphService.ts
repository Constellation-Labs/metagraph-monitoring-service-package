import axios from 'axios';

import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphClusterInfo,
  MetagraphNode,
  MetagraphNodeInfo,
  MetagraphSnapshotInfo,
} from '@interfaces/services/metagraph/IMetagraphService';
import { NodeStatuses } from '@shared/constants';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class ConstellationMetagraphService
  implements IMetagraphService
{
  config: Config;
  metagraphId: string;
  nodes: MetagraphNode[];
  networkName: string;
  loggerService: ILoggerService;
  private logger: Logger;
  metagraphSnapshotInfo: MetagraphSnapshotInfo;
  beUrl: string;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.metagraphId = this.config.metagraph.id;
    this.nodes = this.config.metagraph.nodes;
    this.networkName = this.config.network.name;
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'MetagraphService');
    this.beUrl = `https://be-${this.networkName}.constellationnetwork.io/currency/${this.metagraphId}/snapshots/latest`;
    this.metagraphSnapshotInfo = {
      lastSnapshotTimestamp: 0,
      lastSnapshotOrdinal: 0,
      lastSnapshotHash: '',
      ownerAddress: '',
    };
  }

  async setLastMetagraphInfo(): Promise<void> {
    try {
      const response = await axios.get(this.beUrl);
      const lastSnapshotTimestamp: number = response.data.data.timestamp;
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;
      const ownerAddress: string = response.data.data.ownerAddress;

      this.logger.info(
        `Last snapshot: metagraph=${this.metagraphId}, ordinal=${lastSnapshotOrdinal}, hash=${lastSnapshotHash}`,
      );

      this.metagraphSnapshotInfo = {
        lastSnapshotTimestamp,
        lastSnapshotOrdinal,
        lastSnapshotHash,
        ownerAddress,
      };
    } catch (e) {
      throw Error(
        `Error when searching for metagraph on: ${this.beUrl}. Error: ${e}`,
      );
    }
  }

  async getNodeInfo(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphNodeInfo | null> {
    try {
      const response = await axios.get(
        `http://${nodeIp}:${nodePort}/node/info`,
      );
      const nodeInfo: MetagraphNodeInfo = response.data;
      return nodeInfo;
    } catch (e) {
      return null;
    }
  }

  async getLatestGlobalSnapshotOfMetagraph(): Promise<MetagraphSnapshotInfo> {
    try {
      const response = await axios.get(this.beUrl);
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;
      const lastSnapshotTimestamp: number = response.data.data.timestamp;
      const ownerAddress: string = response.data.data.ownerAddress;

      this.logger.info(
        `Latest global snapshot: metagraph=${this.metagraphId}, ordinal=${lastSnapshotOrdinal}, hash=${lastSnapshotHash}`,
      );

      return {
        lastSnapshotOrdinal,
        lastSnapshotHash,
        lastSnapshotTimestamp,
        ownerAddress,
      };
    } catch (e) {
      throw Error(
        `Error when searching for snapshot on: ${this.beUrl}. Error: ${e}`,
      );
    }
  }

  async checkIfNodeIsHealthy(nodeIp: string, nodePort: number) {
    const nodeInfo = await this.getNodeInfo(nodeIp, nodePort);
    if (!nodeInfo) {
      this.logger.warn(`Node ${nodeIp}:${nodePort} is unhealthy (unreachable)`);
      return false;
    }
    if (nodeInfo.state !== NodeStatuses.READY) {
      this.logger.warn(
        `Node ${nodeIp}:${nodePort} is unhealthy (state=${nodeInfo.state})`,
      );
      return false;
    }

    this.logger.info(`Node ${nodeIp}:${nodePort} is healthy`);
    return true;
  }

  private isNodeInValidRestartingInProgressState(nodeState: string): boolean {
    return (
      [
        NodeStatuses.DOWNLOAD_IN_PROGRESS,
        NodeStatuses.OBSERVING,
        NodeStatuses.WAITING_FOR_READY,
      ] as string[]
    ).includes(nodeState);
  }

  async checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean> {
    const nodeInfo = await this.getNodeInfo(nodeIp, nodePort);
    if (!nodeInfo) {
      this.logger.warn(
        `Node ${nodeIp} is unreachable, skipping snapshot check`,
      );
      return false;
    }

    if (this.isNodeInValidRestartingInProgressState(nodeInfo.state)) {
      this.logger.info(
        `Node ${nodeIp}:${nodePort} is in state ${nodeInfo.state}, considering healthy`,
      );
      return true;
    }

    const nodeUrl = `http://${nodeIp}:${nodePort}/snapshots/${snapshotHash}`;
    try {
      await axios.get(nodeUrl);
      this.logger.info(`Snapshot found on node ${nodeIp}`);
      return true;
    } catch (e) {
      this.logger.warn(`Snapshot not found on node ${nodeIp}`);
      return false;
    }
  }

  async getL0ForkedNodes(nodes: MetagraphNode[]): Promise<MetagraphNode[]> {
    const latestSnapshot = await this.getLatestGlobalSnapshotOfMetagraph();
    const forkedNodes: MetagraphNode[] = [];
    for (const node of nodes) {
      this.logger.info(
        `Checking snapshot ${latestSnapshot.lastSnapshotHash} on node ${node.ip}`,
      );

      const snapshotExistsInNode = await this.checkIfSnapshotExistsOnNode(
        node.ip,
        this.config.metagraph.layers.ml0.ports.public,
        latestSnapshot.lastSnapshotHash,
      );

      if (!snapshotExistsInNode) {
        this.logger.warn(
          `Snapshot ${latestSnapshot.lastSnapshotHash} missing on node ${node.ip}, marking as forked`,
        );
        forkedNodes.push(node);
      }
    }

    return forkedNodes;
  }

  async getNodeClusterPOV(
    nodeIp: string,
    nodePort: number,
  ): Promise<MetagraphClusterInfo[]> {
    try {
      const response = await axios.get(
        `http://${nodeIp}:${nodePort}/cluster/info`,
      );
      const nodeInfo: MetagraphClusterInfo[] = response.data;
      return nodeInfo;
    } catch (e) {
      return [];
    }
  }
}
