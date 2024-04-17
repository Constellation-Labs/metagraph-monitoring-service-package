import axios from 'axios';

import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfigs } from 'src';

import sleep from './sleep';

export default async (
  config: MonitoringConfigs,
  metagraphNode: MetagraphNode,
  layer: AvailableLayers,
  state: string,
  logger: ILoggerService,
): Promise<boolean | undefined> => {
  const port = config.metagraph.layers[layer].ports.public;
  const LIMIT = 100;
  const url = `http://${metagraphNode.ip}:${port}/node/info`;
  logger.info(
    `Checking if node ${metagraphNode.ip} on layer ${layer} is ${state}`,
  );

  for (let idx = 0; idx < LIMIT; idx++) {
    try {
      const response = await axios.get(url);
      const nodeState: string = response.data.state;
      if (nodeState === state) {
        return true;
      }

      if (idx === LIMIT - 1) {
        throw new Error(
          `Node ${metagraphNode.ip} on layer ${layer} doesn't reach ${state} after ${5 * LIMIT} seconds`,
        );
      }

      logger.info(
        `Node ${metagraphNode.ip} on layer ${layer} not ${state} yet, waiting 5s (${idx + 1}/${LIMIT})`,
      );
      await sleep(5 * 1000);
    } catch (e) {
      if (idx === LIMIT - 1) {
        throw new Error(
          `Node ${metagraphNode.ip} on layer ${layer} doesn't reach ${state} after ${5 * LIMIT} seconds`,
        );
      }

      logger.info(
        `Node ${metagraphNode.ip} on layer ${layer} not ${state} yet, waiting 5s (${idx + 1}/${LIMIT})`,
      );
      await sleep(5 * 1000);
    }
  }
};
