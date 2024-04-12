import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { AvailableLayers } from '@shared/constants';

export default class NoSeedlistService implements ISeedlistService {
  logger: ILoggerService;

  constructor(logger: ILoggerService) {
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[NoSeedlistService] ${message}`);
  }

  async buildSeedlistInformation(
    layer: AvailableLayers,
  ): Promise<SeedListInfo> {
    this.customLogger(`No seedlist for layer ${layer}`);
    return {
      url: '',
      fileName: '',
    };
  }
}
