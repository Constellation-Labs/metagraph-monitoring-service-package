import { utc } from 'moment';

import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullMetagraph } from '../groups/FullMetagraph';

export default class SnapshotsStopped implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;

  name = 'Snapshots Stopped';
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  loggerService: ILoggerService;

  private MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS = 4;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.sshServices = monitoringConfiguration.sshServices;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[SnapshotsStopped] ${message}`);
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
      this.monitoringConfiguration,
      this.globalNetworkService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
