import { Layers } from '@shared/constants';

import { SeedListInfo } from './types';

export default interface ISeedlistService {
  buildSeedlistInformation(layer: Layers): SeedListInfo;
}
