import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

export default class S3SeedlistService implements ISeedlistService {
  loggerService: ILoggerService;
  config: Config;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
    this.config = monitoringConfiguration.config;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[S3SeedlistService] ${message}`);
  }

  private async buildS3SeedlistInformation(layer: AvailableLayers) {
    const seedlistInformation = this.config.metagraph.layers[layer].seedlist;

    if (!seedlistInformation || Object.keys(seedlistInformation).length === 0) {
      throw Error(`Could not get information of seedlist at layer ${layer}`);
    }

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

    const seedlistUrl = `${base_url}`;
    return {
      url: seedlistUrl,
      fileName: file_name,
    };
  }

  async buildSeedlistInformation(
    layer: AvailableLayers,
  ): Promise<SeedListInfo> {
    return await this.buildS3SeedlistInformation(layer);
  }
}
