import axios from 'axios';

import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
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

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.metagraphId = this.config.metagraph.id;
    this.nodes = this.config.metagraph.nodes;
    this.networkName = this.config.network.name;
    this.loggerService = monitoringConfiguration.loggerService;
    this.metagraphSnapshotInfo = {
      lastSnapshotTimestamp: 0,
      lastSnapshotOrdinal: 0,
      lastSnapshotHash: '',
    };
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[ConstellationMetagraphService] ${message}`);
  }

  async setLastMetagraphInfo(): Promise<void> {
    const beUrl = `https://be-${this.networkName}.constellationnetwork.io/currency/${this.metagraphId}/snapshots/latest`;
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
    if (nodeInfo.state !== NodeStatuses.READY) {
      this.customLogger(`Node ${nodeIp}:${nodePort} is UNHEALTHY`);
      return false;
    }

    this.customLogger(`Node ${nodeIp}:${nodePort} is HEALTHY`);
    return true;
  }
}
