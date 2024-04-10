import IGlobalNetworkService from '@interfaces/IGlobalNetworkService';
import IMetagraphService from '@interfaces/IMetagraphService';
import ISeedlistService from '@interfaces/ISeedlistService';
import ISshService from '@interfaces/ISshService';
import getLogsNames from '@utils/get-logs-names';

import ForceMetagraphRestart from './restart/conditions/ForceMetagraphRestart';
import SnapshotsStopped from './restart/conditions/SnapshotsStopped';
import UnhealthyNodes from './restart/conditions/UnhealthyNodes';

export default class CheckMetagraphHealth {
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private globalNetworkService: IGlobalNetworkService;
  private seedlistService: ISeedlistService;
  constructor(
    sshServices: ISshService[],
    metagraphService: IMetagraphService,
    globalNetworkService: IGlobalNetworkService,
    seedlistService: ISeedlistService,
  ) {
    this.sshServices = sshServices;
    this.metagraphService = metagraphService;
    this.globalNetworkService = globalNetworkService;
    this.seedlistService = seedlistService;
  }
  async execute() {
    try {
      console.log(`Starting the restart script`);

      const referenceSourceNode =
        await this.globalNetworkService.getReferenceSourceNode();
      if (!referenceSourceNode) {
        throw Error('Could not get the reference source node');
      }

      console.log(`Getting possible metagraph restart type`);
      const logsNames = getLogsNames();

      const forceMetagraphRestart = await new ForceMetagraphRestart(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        referenceSourceNode,
        logsNames,
      );

      if (await forceMetagraphRestart.shouldRestartMetagraph()) {
        await forceMetagraphRestart.triggerRestart();
        return;
      }

      const snapshotsStopped = await new SnapshotsStopped(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        referenceSourceNode,
        logsNames,
      );

      if (await snapshotsStopped.shouldRestartMetagraph()) {
        await snapshotsStopped.triggerRestart();
        return;
      }

      const unhealthyNodes = await new UnhealthyNodes(
        this.sshServices,
        this.metagraphService,
        this.seedlistService,
        referenceSourceNode,
        logsNames,
      );

      if (await unhealthyNodes.shouldRestartMetagraph()) {
        await unhealthyNodes.triggerRestart();
        return;
      }
    } catch (e) {
      console.log('Error');
    }
  }
}

const checkMetagraphHealth = async () => {};
checkMetagraphHealth();
