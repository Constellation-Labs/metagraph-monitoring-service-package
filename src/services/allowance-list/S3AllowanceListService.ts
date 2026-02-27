import { IAllowanceListService } from '@interfaces/index';
import { AllowanceListInfo } from '@interfaces/services/allowance-list/IAllowanceListService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class S3AllowanceListService implements IAllowanceListService {
  loggerService: ILoggerService;
  private logger: Logger;
  config: Config;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'S3AllowanceList');
    this.config = monitoringConfiguration.config;
  }

  private async buildS3AllowanceListInformation(layer: AvailableLayers) {
    const allowanceListInformation =
      this.config.metagraph.layers[layer].allowance_list;

    if (
      !allowanceListInformation ||
      Object.keys(allowanceListInformation).length === 0
    ) {
      throw Error(
        `Could not get information of allowance list at layer ${layer}`,
      );
    }

    const infos = allowanceListInformation as object;
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

    const allowanceListUrl = `${base_url}`;
    return {
      url: allowanceListUrl,
      fileName: file_name,
    };
  }

  async buildAllowanceListformation(
    layer: AvailableLayers,
  ): Promise<AllowanceListInfo> {
    return await this.buildS3AllowanceListInformation(layer);
  }
}
