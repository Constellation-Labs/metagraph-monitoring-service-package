import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullMetagraph } from '../groups/FullMetagraph';

export default class ForceMetagraphRestart implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;

  name = 'Force Metagraph Restart';
  config: Config;
  sshServices: ISshService[];
  metagraphService: IMetagraphService;
  globalNetworkService: IGlobalNetworkService;
  seedlistService: ISeedlistService;
  allowanceListService: IAllowanceListService;
  loggerService: ILoggerService;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.allowanceListService = monitoringConfiguration.allowanceListService;
    this.loggerService = monitoringConfiguration.loggerService;
  }

  async shouldRestart(): Promise<ShouldRestartInfo> {
    return new Promise((resolve) =>
      resolve({
        shouldRestart: false,
        restartType: 'Full metagraph',
      }),
    );
  }

  async triggerRestart(): Promise<void> {
    const fullMetagraph = new FullMetagraph(
      this.monitoringConfiguration,
      this.globalNetworkService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
