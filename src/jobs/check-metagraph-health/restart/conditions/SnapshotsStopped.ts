import { utc } from 'moment';

import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import { NetworkNode } from '@interfaces/services/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/IMetagraphService';
import ISeedlistService from '@interfaces/services/ISeedlistService';
import ISshService from '@interfaces/services/ISshService';
import { LogsNames } from '@utils/get-logs-names';

import { FullMetagraph } from '../types/FullMetagraph';

export default class SnapshotsStopped implements IRestartCondition {
  metagraphService: IMetagraphService;
  sshServices: ISshService[];
  seedlistService: ISeedlistService;
  referenceSourceNode: NetworkNode;
  logsNames: LogsNames;

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

  async shouldRestart(): Promise<boolean> {
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
