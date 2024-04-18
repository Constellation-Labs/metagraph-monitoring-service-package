import axios from 'axios';

import IGlobalNetworkService, {
  GlobalSnapshotInfo,
  NetworkNode,
} from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

export default class ConstellationGlobalNetworkService
  implements IGlobalNetworkService
{
  name: string;
  nodes: NetworkNode[];
  beUrl: string;
  referenceSourceNode: NetworkNode;
  loggerService: ILoggerService;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    const { name, nodes } = monitoringConfiguration.config.network;
    this.name = name;
    if (!nodes || Object.keys(nodes).length === 0) {
      throw Error(`Could not find nodes of network: ${name}`);
    }
    this.nodes = nodes;
    this.beUrl = `https://be-${name}.constellationnetwork.io/global-snapshots/latest`;
    this.referenceSourceNode = { ip: '', id: '', port: 0 };
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[ConstellationGlobalNetworkService] ${message}`);
  }

  async getLatestGlobalSnapshotOfNetwork(): Promise<GlobalSnapshotInfo> {
    try {
      const response = await axios.get(this.beUrl);
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;

      this.customLogger(
        `LAST SNAPSHOT OF NETWORK: ${this.name}. Ordinal: ${lastSnapshotOrdinal}. Hash: ${lastSnapshotHash}`,
      );

      return {
        lastSnapshotOrdinal,
        lastSnapshotHash,
      };
    } catch (e) {
      throw Error(
        `Error when searching for snapshot on: ${this.beUrl}. Error: ${e}`,
      );
    }
  }

  async checkIfSnapshotExistsOnNode(
    nodeIp: string,
    nodePort: number,
    snapshotHash: string,
  ): Promise<boolean> {
    const nodeUrl = `http://${nodeIp}:${nodePort}/global-snapshots/${snapshotHash}`;
    try {
      await axios.get(nodeUrl);
      this.customLogger(`Snapshot exists on node: ${nodeIp}`);
      return true;
    } catch (e) {
      this.customLogger(`Snapshot does not exists on node: ${nodeIp}`);
      return false;
    }
  }

  async setReferenceSourceNode(): Promise<void> {
    const { lastSnapshotHash } = await this.getLatestGlobalSnapshotOfNetwork();

    for (const node of this.nodes) {
      const snapshotExistsOnNode = await this.checkIfSnapshotExistsOnNode(
        node.ip,
        node.port,
        lastSnapshotHash,
      );

      if (snapshotExistsOnNode) {
        this.referenceSourceNode = node;
        return;
      }
    }
    throw Error(`Could not find reference source node`);
  }
}
