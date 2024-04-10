import axios from 'axios';

import {
  GlobalSnapshotInfo,
  NetworkNode,
} from '@interfaces/services/IGlobalNetworkService';

export default class ConstellationGlobalNetworkService {
  name: string;
  nodes: NetworkNode[];
  beUrl: string;

  constructor(networkName: string, nodes: NetworkNode[]) {
    this.name = networkName;
    if (!nodes || Object.keys(nodes).length === 0) {
      throw Error(`Could not find nodes of network: ${networkName}`);
    }
    this.nodes = nodes;
    this.beUrl = `https://be-${networkName}.constellationnetwork.io/global-snapshots/latest`;
  }

  async getLatestGlobalSnapshotOfNetwork(): Promise<GlobalSnapshotInfo> {
    try {
      const response = await axios.get(this.beUrl);
      const lastSnapshotOrdinal: number = response.data.data.ordinal;
      const lastSnapshotHash: string = response.data.data.hash;

      console.log(
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
      console.log(`Snapshot exists on node: ${nodeIp}`);
      return true;
    } catch (e) {
      console.log(`Snapshot does not exists on node: ${nodeIp}`);
      return false;
    }
  }

  async getReferenceSourceNode(): Promise<NetworkNode | null> {
    console.log(
      `Starting to get reference source node for network: ${this.name}`,
    );

    const { lastSnapshotHash } = await this.getLatestGlobalSnapshotOfNetwork();

    for (const node of this.nodes) {
      const snapshotExistsOnNode = await this.checkIfSnapshotExistsOnNode(
        node.ip,
        node.port,
        lastSnapshotHash,
      );

      if (snapshotExistsOnNode) {
        return node;
      }
    }

    return null;
  }
}
