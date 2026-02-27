import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';
import { FullMetagraph } from '../groups/FullMetagraph';

export default class SnapshotsStopped implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'Snapshots Stopped';

  private MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS = 4;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'SnapshotsStopped',
    );
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    this.logger.info('Checking snapshot production');
    const { lastSnapshotTimestamp, lastSnapshotOrdinal } =
      await this.monitoringConfiguration.metagraphService.metagraphSnapshotInfo;

    const lastSnapshotTimestampDiff = dayjs
      .utc()
      .diff(lastSnapshotTimestamp, 'minutes');

    if (lastSnapshotTimestampDiff <= this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS) {
      this.logger.info('Snapshots are being produced normally');
      return {
        shouldRestart: false,
        restartType: '',
      };
    }

    this.logger.warn(
      `Snapshots stalled: last produced ${lastSnapshotTimestampDiff}min ago (limit=${this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS}min), ordinal=${lastSnapshotOrdinal}`,
    );

    return {
      shouldRestart: true,
      restartType: 'Full Metagraph',
      lastMetagraphSnapshotOrdinal: lastSnapshotOrdinal,
    };
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.monitoringConfiguration,
      this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
