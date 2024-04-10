import axios from 'axios';

import config from '@config/config.json';
import IMetagraphService, {
  MetagraphNode,
  MetagraphNodeInfo,
  MetagraphSnapshotInfo,
} from '@interfaces/services/IMetagraphService';

export default class ConstellationMetagraphService
  implements IMetagraphService
{
  public metagraphId: string;
  public nodes: MetagraphNode[];
  public networName: string;

  constructor() {
    this.metagraphId = config.metagraph.id;
    this.nodes = config.metagraph.nodes;
    this.networName = config.network.name;
  }

  async getLastMetagraphInfo(): Promise<MetagraphSnapshotInfo> {
    const beUrl = `https://be-${this.networName}.constellationnetwork.io/currency/${this.metagraphId}/snapshots/latest`;
    try {
      const response = await axios.get(beUrl);
      const lastSnapshotTimestamp: number = response.data.data.timestamp;
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;

      console.log(
        `LAST SNAPSHOT OF METAGRAPH ${this.metagraphId}: ${lastSnapshotTimestamp}. Ordinal: ${lastSnapshotOrdinal}. Hash: ${lastSnapshotHash}`,
      );

      return {
        lastSnapshotTimestamp,
        lastSnapshotOrdinal,
        lastSnapshotHash,
      };
    } catch (e) {
      throw Error(
        `Error when searching for metagraph on: ${beUrl}. Error: ${e}`,
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

  async checkIfNodeIsHealthy(nodeIp: string, nodePort: number) {
    const nodeInfo = await this.getNodeInfo(nodeIp, nodePort);
    if (!nodeInfo) {
      console.log(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }
    if (nodeInfo.state !== 'Ready') {
      console.log(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }

    console.log(`Node ${nodeIp}:${nodePort} is HEALTHY`);
    return true;
  }
}
