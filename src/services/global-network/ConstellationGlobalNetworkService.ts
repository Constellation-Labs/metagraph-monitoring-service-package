import axios from 'axios';

import IGlobalNetworkService, {
  GlobalSnapshotInfo,
  NetworkNode,
} from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';

export default class ConstellationGlobalNetworkService
  implements IGlobalNetworkService
{
  name: string;
  nodes: NetworkNode[];
  beUrl: string;
  referenceSourceNode: NetworkNode;
  logger: ILoggerService;

  constructor(
    networkName: string,
    nodes: NetworkNode[],
    logger: ILoggerService,
  ) {
    this.name = networkName;
    if (!nodes || Object.keys(nodes).length === 0) {
      throw Error(`Could not find nodes of network: ${networkName}`);
    }
    this.nodes = nodes;
    this.beUrl = `https://be-${networkName}.constellationnetwork.io/global-snapshots/latest`;
    this.referenceSourceNode = { ip: '', id: '', port: 0 };
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[ConstellationGlobalNetworkService] ${message}`);
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
