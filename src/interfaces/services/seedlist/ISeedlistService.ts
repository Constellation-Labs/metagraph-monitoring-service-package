import { Layers } from '@shared/constants';

import ILoggerService from '../logger/ILoggerService';

export type SeedListInfo = {
  fileName: string;
  url: string;
};

export default interface ISeedlistService {
  logger: ILoggerService;
  buildSeedlistInformation(layer: Layers): Promise<SeedListInfo>;
}
