import { AvailableLayers } from '@shared/constants';

import ILoggerService from '../logger/ILoggerService';

export type SeedListInfo = {
  fileName: string;
  url: string;
};

export default interface ISeedlistService {
  loggerService: ILoggerService;
  buildSeedlistInformation(layer: AvailableLayers): Promise<SeedListInfo>;
}
