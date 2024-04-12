import axios from 'axios';

import config from '@config/config.json';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { Layers } from '@shared/constants';

export default class GithubSeedlistService implements ISeedlistService {
  logger: ILoggerService;

  constructor(logger: ILoggerService) {
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[GithubSeedlistService] ${message}`);
  }

  async checkIfSeedlistExists(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url);

      if (
        response.headers['content-length'] &&
        response.headers['content-type'] === 'application/octet-stream' &&
        parseInt(response.headers['content-length'], 10) > 0
      ) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Seedlist not found in url: ${url}`);
      return false;
    }
  }

  private async buildGithubSeedlistInformation(layer: Layers) {
    const seedlistInformation = config.metagraph.layers[layer].seedlist;

    if (!seedlistInformation || Object.keys(seedlistInformation).length === 0) {
      throw Error(`Could not get information of seedlist at layer ${layer}`);
    }

    const { version } = config.metagraph;
    const { base_url, file_name } = seedlistInformation;
    const seedlistUrl = `${base_url}/${version}/${file_name}`;
    this.customLogger(`Checking if file exists on Github URL: ${seedlistUrl}`);
    const seedlistExists = await this.checkIfSeedlistExists(seedlistUrl);
    if (!seedlistExists) {
      throw Error(
        `Seedlist does not exists in url: ${seedlistUrl} to layer: ${layer}`,
      );
    }

    return {
      url: seedlistUrl,
      fileName: file_name,
    };
  }

  async buildSeedlistInformation(layer: Layers): Promise<SeedListInfo> {
    return await this.buildGithubSeedlistInformation(layer);
  }
}
