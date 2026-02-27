import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class NoSeedlistService implements ISeedlistService {
  loggerService: ILoggerService;
  private logger: Logger;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'NoSeedlist');
  }

  async buildSeedlistInformation(
    layer: AvailableLayers,
  ): Promise<SeedListInfo> {
    this.logger.info(`No seedlist for layer ${layer}`);
    return {
      url: '',
      fileName: '',
    };
  }
}
