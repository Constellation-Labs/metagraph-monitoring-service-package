import { Layers } from '@shared/constants';

export type SeedListInfo = {
  fileName: string;
  url: string;
};

export default interface ISeedlistService {
  buildSeedlistInformation(layer: Layers): SeedListInfo;
}
