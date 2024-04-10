import config from '@config/config.json';
import ISeedlistService, {
  SeedListInfo,
} from '@interfaces/services/ISeedlistService';
import { Layers } from '@shared/constants';

export default class GithubSeedlistService implements ISeedlistService {
  private buildGithubSeedlistInformation = (layer: Layers) => {
    const seedlistInformation = config.metagraph.layers[layer].seedlist;

    if (!seedlistInformation || Object.keys(seedlistInformation).length === 0) {
      throw Error(`Could not get information of seedlist at layer ${layer}`);
    }

    const { version } = config.metagraph;
    const { base_url, file_name } = seedlistInformation;

    const seedlistUrl = `${base_url}/${version}/${file_name}`;
    console.log(`Seedlist URL for layer ${layer}: ${seedlistUrl}`);

    return {
      url: seedlistUrl,
      fileName: file_name,
    };
  };

  buildSeedlistInformation(layer: Layers): SeedListInfo {
    return this.buildGithubSeedlistInformation(layer);
  }
}
