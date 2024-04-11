import config from '@config/config.json';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';

import waitForNode from '../utils/wait-for-node';

export class DataL1 {
  sshService: ISshService;
  metagraphService: IMetagraphService;
  seedlistService: ISeedlistService;
  logger: ILoggerService;

  currentNode: MetagraphNode;
  referenceMetagraphL0Node: MetagraphNode;
  referenceSourceNode: NetworkNode;

  constructor(
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    logger: ILoggerService,
    referenceMetagraphL0Node: MetagraphNode,
    referenceSourceNode: NetworkNode,
  ) {
    this.sshService = sshService;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.logger = logger;

    this.currentNode = sshService.metagraphNode;
    this.referenceMetagraphL0Node = referenceMetagraphL0Node;
    this.referenceSourceNode = referenceSourceNode;
  }

  private async customLogger(message: string) {
    this.logger.info(`[Data L1] ${message}`);
  }

  private async buildNodeEnvVariables() {
    const {
      name: keyStore,
      alias: keyAlias,
      password,
    } = this.currentNode.key_file;

    const {
      public: publicPort,
      p2p: p2pPort,
      cli: cliPort,
    } = config.metagraph.layers.dl1.ports;

    const {
      ip: referenceGl0Ip,
      port: refereceGl0Port,
      id: referenceGl0Id,
    } = this.referenceSourceNode;

    const { ip: referenceMl0Ip } = this.referenceMetagraphL0Node;

    const metagraphL0ReferenceNodeInfo =
      await this.metagraphService.getNodeInfo(
        referenceMl0Ip,
        config.metagraph.layers.ml0.ports.public,
      );

    if (!metagraphL0ReferenceNodeInfo) {
      throw new Error(`Could not get reference metagraph l0 node`);
    }

    const additionalEnvVariables =
      config.metagraph.layers.dl1.additional_env_variables
        .map((envVariable) => `export ${envVariable}`)
        .join('\n');

    return `
    export CL_KEYSTORE="${keyStore}" 
    export CL_KEYALIAS="${keyAlias}" 
    export CL_PASSWORD="${password}" 
    export CL_PUBLIC_HTTP_PORT=${publicPort} 
    export CL_P2P_HTTP_PORT=${p2pPort} 
    export CL_CLI_HTTP_PORT=${cliPort} 
    export CL_GLOBAL_L0_PEER_HTTP_HOST=${referenceGl0Ip} 
    export CL_GLOBAL_L0_PEER_HTTP_PORT=${refereceGl0Port} 
    export CL_GLOBAL_L0_PEER_ID=${referenceGl0Id} 
    export CL_L0_PEER_HTTP_HOST=${metagraphL0ReferenceNodeInfo.host} 
    export CL_L0_PEER_HTTP_PORT=${metagraphL0ReferenceNodeInfo.publicPort} 
    export CL_L0_PEER_ID=${metagraphL0ReferenceNodeInfo.id} 
    export CL_L0_TOKEN_IDENTIFIER=${config.metagraph.id} 
    export CL_APP_ENV=${config.network.name} 
    export CL_COLLATERAL=0
    ${additionalEnvVariables}
    cd data-l1 
    `;
  }

  private async startAndJoinValidator(validatorHost: ISshService) {
    const validatorDl1 = new DataL1(
      validatorHost,
      this.metagraphService,
      this.seedlistService,
      this.logger,
      this.currentNode,
      this.referenceSourceNode,
    );
    await validatorDl1.startValidatorNodeDl1();
    await waitForNode(
      validatorDl1.currentNode,
      'dl1',
      'ReadyToJoin',
      this.logger,
    );
    await validatorDl1.joinNodeToCluster(this.currentNode);
  }

  private async updateSeedlist(
    seedlistUrl?: string,
    seedlistFileName?: string,
  ) {
    if (!seedlistUrl) {
      this.customLogger('Node does not have seedlist set');
      return;
    }

    this.customLogger(`Updating seedlist on node`);
    const command = `
    cd data-l1
    wget -O ${seedlistFileName} ${seedlistUrl}
    `;

    await this.sshService.executeCommand(command);
  }

  async startInitialValidatorDl1() {
    this.customLogger(
      `Starting node ${this.currentNode.ip} as initial validator`,
    );

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('dl1');

    const command = await this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command} 
    ${
      url
        ? `nohup java -jar data-l1.jar run-initial-validator --ip ${this.currentNode.ip} --seedlist ${fileName} > data-l1-startup.log 2>&1 &`
        : `nohup java -jar data-l1.jar run-initial-validator --ip ${this.currentNode.ip} > data-l1-startup.log 2>&1 &`
    }
    `;

    await this.sshService.executeCommand(parsedCommand);
    this.customLogger(
      `Finished ${this.currentNode.ip} node as initial validator`,
    );
  }

  async startValidatorNodeDl1() {
    this.customLogger(`Starting node ${this.currentNode.ip} as validator`);

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('dl1');

    const command = await this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command}
    ${
      url
        ? `nohup java -jar data-l1.jar run-validator --ip ${this.currentNode.ip} --seedlist ${fileName} > data-l1-startup.log 2>&1 &`
        : `nohup java -jar data-l1.jar run-validator --ip ${this.currentNode.ip} > data-l1-startup.log 2>&1 &`
    }
    `;

    await this.sshService.executeCommand(parsedCommand);

    this.customLogger(`Finished ${this.currentNode.ip} node as validator`);
  }

  async joinNodeToCluster(referenceMetagraphNode: MetagraphNode) {
    this.customLogger(
      `Joining node ${this.currentNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );

    const { ip: referenceIp } = referenceMetagraphNode;
    const { public: publicPort, cli: cliPort } =
      config.metagraph.layers.dl1.ports;

    const nodeInfo = await this.metagraphService.getNodeInfo(
      referenceIp,
      publicPort,
    );
    if (!nodeInfo) {
      throw new Error(
        `Could not get node info of node ${referenceIp} on layer dl1`,
      );
    }

    const command = `
    cd data-l1 
    curl -v -X POST http://localhost:${cliPort}/cluster/join -H "Content-type: application/json" -d '{ "id":"${nodeInfo.id}", "ip": "${nodeInfo.host}", "p2pPort": ${nodeInfo.p2pPort} }'`;

    this.customLogger(`Joining to node ${JSON.stringify(nodeInfo)}`);

    await this.sshService.executeCommand(command);

    this.customLogger(
      `Finished joining node ${this.currentNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );
  }

  async startCluster(validatorHosts: ISshService[]) {
    await this.startInitialValidatorDl1();
    await waitForNode(this.currentNode, 'dl1', 'Ready', this.logger);
    const promises = [];
    for (const validatorHost of validatorHosts) {
      promises.push(this.startAndJoinValidator(validatorHost));
    }
    await Promise.all(promises);
  }
}
