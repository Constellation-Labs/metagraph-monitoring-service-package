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

export default class ConstellationMetagraphService
  implements IMetagraphService
{
  config: Config;
  metagraphId: string;
  nodes: MetagraphNode[];
  networkName: string;
  loggerService: ILoggerService;
  metagraphSnapshotInfo: MetagraphSnapshotInfo;
  beUrl: string;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.metagraphId = this.config.metagraph.id;
    this.nodes = this.config.metagraph.nodes;
    this.networkName = this.config.network.name;
    this.loggerService = monitoringConfiguration.loggerService;
    this.beUrl = `https://be-${this.networkName}.constellationnetwork.io/currency/${this.metagraphId}/snapshots/latest`;
    this.metagraphSnapshotInfo = {
      lastSnapshotTimestamp: 0,
      lastSnapshotOrdinal: 0,
      lastSnapshotHash: '',
      ownerAddress: '',
    };
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[ConstellationMetagraphService] ${message}`);
  }

  async setLastMetagraphInfo(): Promise<void> {
    try {
      const response = await axios.get(this.beUrl);
      const lastSnapshotTimestamp: number = response.data.data.timestamp;
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;
      const ownerAddress: string = response.data.data.ownerAddress;

      this.customLogger(
        `LAST SNAPSHOT OF METAGRAPH ${this.metagraphId}: ${lastSnapshotTimestamp}. Ordinal: ${lastSnapshotOrdinal}. Hash: ${lastSnapshotHash}`,
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

      this.customLogger(
        `LAST SNAPSHOT OF METAGRAPH: ${this.metagraphId}. Ordinal: ${lastSnapshotOrdinal}. Hash: ${lastSnapshotHash}. Timestamp: ${lastSnapshotTimestamp}`,
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
      this.customLogger(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }
    if (nodeInfo.state !== NodeStatuses.READY) {
      this.customLogger(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }

    this.customLogger(`Node ${nodeIp}:${nodePort} is HEALTHY`);
    return true;
  }

  private isNodeInValidRestartingInProgressState(nodeState: string): boolean {
    return [
      NodeStatuses.DOWNLOAD_IN_PROGRESS,
      NodeStatuses.OBSERVING,
      NodeStatuses.WAITING_FOR_READY,
    ].includes(nodeState);
  }

  async checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean> {
    const nodeInfo = await this.getNodeInfo(nodeIp, nodePort);
    if (!nodeInfo) {
      this.customLogger(`Unhealthy node: ${nodeIp}`);
      return false;
    }

    if (this.isNodeInValidRestartingInProgressState(nodeInfo.state)) {
      this.customLogger(
        `Node ${nodeIp}:${nodePort} is in on state: ${nodeInfo.state}. So, it will be considered healthy`,
      );
      return true;
    }

    const nodeUrl = `http://${nodeIp}:${nodePort}/snapshots/${snapshotHash}`;
    try {
      await axios.get(nodeUrl);
      this.customLogger(`Snapshot exists on node: ${nodeIp}`);
      return true;
    } catch (e) {
      this.customLogger(`Snapshot does not exists on node: ${nodeIp}`);
      return false;
    }
  }

  async getL0ForkedNodes(nodes: MetagraphNode[]): Promise<MetagraphNode[]> {
    const latestSnapshot = await this.getLatestGlobalSnapshotOfMetagraph();
    const forkedNodes: MetagraphNode[] = [];
    for (const node of nodes) {
      this.customLogger(
        `Checking if the hash ${latestSnapshot.lastSnapshotHash} exists in node ${node.ip}`,
      );

      const snapshotExistsInNode = await this.checkIfSnapshotExistsOnNode(
        node.ip,
        this.config.metagraph.layers.ml0.ports.public,
        latestSnapshot.lastSnapshotHash,
      );

      if (!snapshotExistsInNode) {
        this.customLogger(
          `Snapshot ${latestSnapshot.lastSnapshotHash} does not exists in node ${node.ip}`,
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
