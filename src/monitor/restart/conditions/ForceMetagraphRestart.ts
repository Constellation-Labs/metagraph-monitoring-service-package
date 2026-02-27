import IRestartCondition, {
  ShouldRestartInfo,
} from '@interfaces/restart-conditions/IRestartCondition';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { FullMetagraph } from '../groups/FullMetagraph';

export default class ForceMetagraphRestart implements IRestartCondition {
  private monitoringConfiguration: MonitoringConfiguration;

  name = 'Force Metagraph Restart';

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
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
      this.monitoringConfiguration.globalNetworkService.referenceSourceNode,
    );

    await fullMetagraph.performRestart();
  }
}
