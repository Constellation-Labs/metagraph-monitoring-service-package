import config from '@config/config.json';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IGlobalNetworkService from '@interfaces/services/IGlobalNetworkService';
import IMetagraphService from '@interfaces/services/IMetagraphService';
import ISeedlistService from '@interfaces/services/ISeedlistService';
import ISshService from '@interfaces/services/ISshService';
import conditions from '@jobs/check-metagraph-health/restart/conditions';
import getLogsNames from '@utils/get-logs-names';

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
  async checkAndTriggerRestart() {}
  async execute() {
    console.log(`Starting the restart script`);

    const referenceSourceNode =
      await this.globalNetworkService.getReferenceSourceNode();
    if (!referenceSourceNode) {
      throw Error('Could not get the reference source node');
    }

    console.log(`Getting possible metagraph restart type`);
    const logsNames = getLogsNames();
    for (const restartCondition of config.metagraph.restart_conditions) {
      try {
        const RestartCondition = conditions[restartCondition];
        const iRestartCondition: IRestartCondition = new RestartCondition(
          this.sshServices,
          this.metagraphService,
          this.seedlistService,
          referenceSourceNode,
          logsNames,
        );

        if (await iRestartCondition.shouldRestart()) {
          await iRestartCondition.triggerRestart();
          return;
        }
      } catch (e) {
        console.log(
          `Could not get restart condition: ${restartCondition}, skipping`,
        );
        continue;
      }
    }
  }
}

const checkMetagraphHealth = async () => {};
checkMetagraphHealth();
