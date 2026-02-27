import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { BaseLayer } from './BaseLayer';

export class DataL1 extends BaseLayer {
  readonly layer: AvailableLayers = Layers.DL1;
  readonly layerLabel = 'Data L1';
  readonly jarName = 'data-l1.jar';
  readonly dirName = 'data-l1';
  readonly startupLogName = 'data-l1-startup.log';
  readonly initialMode = 'run-initial-validator';

  referenceMetagraphL0Node: MetagraphNode;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    sshService: ISshService,
    referenceMetagraphL0Node: MetagraphNode,
    referenceSourceNode: NetworkNode,
  ) {
    super(monitoringConfiguration, sshService, referenceSourceNode);
    this.referenceMetagraphL0Node = referenceMetagraphL0Node;
  }

  protected async buildLayerSpecificEnvVariables(): Promise<string> {
    const { ip: referenceMl0Ip } = this.referenceMetagraphL0Node;
    const metagraphL0ReferenceNodeInfo =
      await this.metagraphService.getNodeInfo(
        referenceMl0Ip,
        this.config.metagraph.layers.ml0.ports.public,
      );

    if (!metagraphL0ReferenceNodeInfo) {
      throw new Error('Could not get reference metagraph l0 node');
    }

    return `export CL_L0_PEER_HTTP_HOST=${metagraphL0ReferenceNodeInfo.host}
    export CL_L0_PEER_HTTP_PORT=${metagraphL0ReferenceNodeInfo.publicPort}
    export CL_L0_PEER_ID=${metagraphL0ReferenceNodeInfo.id}`;
  }

  protected createValidatorInstance(validatorHost: ISshService): BaseLayer {
    return new DataL1(
      this.monitoringConfiguration,
      validatorHost,
      this.currentNode,
      this.referenceSourceNode,
    );
  }

  async startInitialValidatorDl1() {
    return this.startInitialNode();
  }

  async startValidatorNodeDl1() {
    return this.startValidatorNode();
  }
}
