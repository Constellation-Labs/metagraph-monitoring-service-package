import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { BaseLayer } from './BaseLayer';

export class MetagraphL0 extends BaseLayer {
  readonly layer: AvailableLayers = Layers.ML0;
  readonly layerLabel = 'Metagraph L0';
  readonly jarName = 'metagraph-l0.jar';
  readonly dirName = 'metagraph-l0';
  readonly startupLogName = 'metagraph-l0-startup.log';
  readonly initialMode = 'run-rollback';

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    sshService: ISshService,
    referenceSourceNode: NetworkNode,
  ) {
    super(monitoringConfiguration, sshService, referenceSourceNode);
  }

  protected createValidatorInstance(validatorHost: ISshService): BaseLayer {
    return new MetagraphL0(
      this.monitoringConfiguration,
      validatorHost,
      this.referenceSourceNode,
    );
  }

  async startRollbackNodeL0() {
    return this.startInitialNode();
  }

  async startValidatorNodeL0() {
    return this.startValidatorNode();
  }
}
