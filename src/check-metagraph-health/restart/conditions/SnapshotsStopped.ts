import { utc } from 'moment';

import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { MonitoringConfigs } from 'src';

import { FullMetagraph } from '../groups/FullMetagraph';

export default class SnapshotsStopped implements IRestartCondition {
  name = 'Snapshots Stopped';
  config: MonitoringConfigs;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetwokService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  private MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS = 4;

  constructor(
    config: MonitoringConfigs,
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetwokService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
  ) {
    this.config = config;
    this.metagraphService = metagraphService;
    this.sshServices = sshServices;
    this.globalNetwokService = globalNetwokService;
    this.seedlistService = seedlistService;
    this.logger = logger;
  }

  private async customLogger(message: string) {
    this.logger.info(`[SnapshotsStopped] ${message}`);
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.customLogger(`Checking if snapshots stopped to being produced`);
    const { lastSnapshotTimestamp } =
      await this.metagraphService.metagraphSnapshotInfo;

    const lastSnapshotTimestampDiff = utc().diff(
      lastSnapshotTimestamp,
      'minutes',
    );

    if (lastSnapshotTimestampDiff <= this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS) {
      this.customLogger(`Snapshots being produced normally`);
      return {
        shouldRestart: false,
        restartType: '',
      };
    }

    this.customLogger(
      `Last snapshot produced greater than ${this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS} minutes ago. Triggering a restart`,
    );

    return {
      shouldRestart: true,
      restartType: 'Full Metagraph',
    };
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.config,
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.globalNetwokService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
