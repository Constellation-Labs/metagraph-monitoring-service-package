import { utc } from 'moment';

import { NetworkNode } from '@interfaces/global-network/types';
import IMetagraphService from '@interfaces/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/seedlist/ISeedlistService';
import ISshService from '@interfaces/ssh/ISshService';
import { LogsNames } from '@utils/get-logs-names';

import { FullMetagraph } from '../types/FullMetagraph';

export default class SnapshotsStopped {
  private metagraphService: IMetagraphService;
  private sshServices: ISshService[];
  private seedlistService: ISeedlistService;
  private referenceSourceNode: NetworkNode;
  private logsNames: LogsNames;

  private MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS = 4;

  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceSourceNode: NetworkNode,
    logsNames: LogsNames,
  ) {
    this.metagraphService = metagraphService;
    this.sshServices = sshServices;
    this.seedlistService = seedlistService;
    this.referenceSourceNode = referenceSourceNode;
    this.logsNames = logsNames;
  }

  async shouldRestartMetagraph(): Promise<boolean> {
    const { lastSnapshotTimestamp } =
      await this.metagraphService.getLastMetagraphInfo();

    const lastSnapshotTimestampDiff = utc().diff(
      lastSnapshotTimestamp,
      'minutes',
    );

    if (lastSnapshotTimestampDiff <= this.MAX_MINUTES_WITHOUT_NEW_SNAPSHOTS) {
      return false;
    }

    return true;
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.sshServices,
      this.metagraphService,
      this.seedlistService,
      this.referenceSourceNode,
      this.logsNames,
    );

    await fullMetagraph.performRestart();
  }
}
