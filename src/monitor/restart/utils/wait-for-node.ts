import axios from 'axios';

import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import { AvailableLayers, NodeStatuses } from '@shared/constants';
import { Config } from 'src/MonitoringConfiguration';

import sleep from './sleep';

export default async function waitForNode(
  config: Config,
  metagraphNode: MetagraphNode,
  layer: AvailableLayers,
  state: string,
  loggerService: ILoggerService,
): Promise<boolean | undefined> {
  const port = config.metagraph.layers[layer].ports.public;
  const LIMIT = 100;
  const url = `http://${metagraphNode.ip}:${port}/node/info`;
  loggerService.info(
    `[${layer}] Waiting for node ${metagraphNode.ip} to reach ${state}`,
  );

  for (let idx = 0; idx < LIMIT; idx++) {
    try {
      const response = await axios.get(url);
      const nodeState: string = response.data.state;
      if (nodeState === state) {
        if (nodeState === NodeStatuses.READY_TO_JOIN) {
          await sleep(10 * 1000);
        }

        return true;
      }

      if (idx === LIMIT - 1) {
        throw new Error(
          `Node ${metagraphNode.ip} on layer ${layer} doesn't reach ${state} after ${5 * LIMIT} seconds`,
        );
      }

      loggerService.info(
        `[${layer}] Node ${metagraphNode.ip} not ${state} yet (${idx + 1}/${LIMIT})`,
      );
      await sleep(5 * 1000);
    } catch (e) {
      if (idx === LIMIT - 1) {
        throw new Error(
          `Node ${metagraphNode.ip} on layer ${layer} doesn't reach ${state} after ${5 * LIMIT} seconds`,
        );
      }

      loggerService.info(
        `[${layer}] Node ${metagraphNode.ip} not ${state} yet (${idx + 1}/${LIMIT})`,
      );
      await sleep(5 * 1000);
    }
  }
}
