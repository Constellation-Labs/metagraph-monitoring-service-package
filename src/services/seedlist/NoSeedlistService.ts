import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/seedlist/ISeedlistService';
import { Layers } from '@shared/constants';

export default class NoSeedlistService implements ISeedlistService {
  logger: ILoggerService;

  constructor(logger: ILoggerService) {
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[NoSeedlistService] ${message}`);
  }

  async buildSeedlistInformation(layer: Layers): Promise<SeedListInfo> {
    this.customLogger(`No seedlist for layer ${layer}`);
    return {
      url: '',
      fileName: '',
    };
  }
}
