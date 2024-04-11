import { utc } from 'moment';

import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import { FullMetagraph } from '../types/FullMetagraph';

export default class SnapshotsStopped implements IRestartCondition {
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  private MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS = 4;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetwokService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
  ) {
    this.metagraphService = metagraphService;
    this.sshServices = sshServices;
    this.globalNetwokService = globalNetwokService;
    this.seedlistService = seedlistService;
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[SnapshotsStopped] ${message}`);
  }

  async shouldRestart(): Promise<boolean> {
    this.customLogger(`Checking if snapshots stopped to being produced`);
    const { lastSnapshotTimestamp } =
      await this.metagraphService.metagraphSnapshotInfo;

    const lastSnapshotTimestampDiff = utc().diff(
      lastSnapshotTimestamp,
      'minutes',
    );

    if (lastSnapshotTimestampDiff <= this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS) {
      this.customLogger(`Snapshots being produced normally`);
      return false;
    }

    this.customLogger(
      `Last snapshot produced greater than ${this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS} ago. Triggering a restart`,
    );

    return true;
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.globalNetwokService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
