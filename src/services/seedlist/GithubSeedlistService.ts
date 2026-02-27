import axios from 'axios';

import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class GithubSeedlistService implements ISeedlistService {
  loggerService: ILoggerService;
  private logger: Logger;
  config: Config;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'GithubSeedlist');
    this.config = monitoringConfiguration.config;
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

  private async buildGithubSeedlistInformation(layer: AvailableLayers) {
    const seedlistInformation = this.config.metagraph.layers[layer].seedlist;

    if (!seedlistInformation || Object.keys(seedlistInformation).length === 0) {
      throw Error(`Could not get information of seedlist at layer ${layer}`);
    }

    const { version } = this.config.metagraph;
    const infos = seedlistInformation as object;
    if (
      !Object.keys(infos).includes('base_url') ||
      !Object.keys(infos).includes('file_name')
    ) {
      throw Error(`Could not find base_url and file_name`);
    }
    const { base_url, file_name } = infos as {
      base_url: string;
      file_name: string;
    };

    const seedlistUrl = `${base_url}/${version}/${file_name}`;
    this.logger.info(`Checking if file exists on Github URL: ${seedlistUrl}`);
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

  async buildSeedlistInformation(
    layer: AvailableLayers,
  ): Promise<SeedListInfo> {
    return await this.buildGithubSeedlistInformation(layer);
  }
}
