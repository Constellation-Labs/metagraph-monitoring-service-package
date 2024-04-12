import axios from 'axios';

import config from '@config/config.json';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
  MetagraphNodeInfo,
  MetagraphSnapshotInfo,
} from '@interfaces/services/metagraph/IMetagraphService';

export default class ConstellationMetagraphService
  implements IMetagraphService
{
  metagraphId: string;
  nodes: MetagraphNode[];
  networName: string;
  logger: ILoggerService;
  metagraphSnapshotInfo: MetagraphSnapshotInfo;

  constructor(logger: ILoggerService) {
    this.metagraphId = config.metagraph.id;
    this.nodes = config.metagraph.nodes;
    this.networName = config.network.name;
    this.logger = logger;
    this.metagraphSnapshotInfo = {
      lastSnapshotTimestamp: 0,
      lastSnapshotOrdinal: 0,
      lastSnapshotHash: '',
    };
  }

  private async customLogger(message: string) {
    this.logger.info(`[ConstellationMetagraphService] ${message}`);
  }

  async setLastMetagraphInfo(): Promise<void> {
    const beUrl = `https://be-${this.networName}.constellationnetwork.io/currency/${this.metagraphId}/snapshots/latest`;
    try {
      const response = await axios.get(beUrl);
      const lastSnapshotTimestamp: number = response.data.data.timestamp;
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;

      this.customLogger(
        `LAST SNAPSHOT OF METAGRAPH ${this.metagraphId}: ${lastSnapshotTimestamp}. Ordinal: ${lastSnapshotOrdinal}. Hash: ${lastSnapshotHash}`,
      );

      this.metagraphSnapshotInfo = {
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
      this.customLogger(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }
    if (nodeInfo.state !== 'Ready') {
      this.customLogger(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }

    this.customLogger(`Node ${nodeIp}:${nodePort} is HEALTHY`);
    return true;
  }
}
