import config from '@config/config.json';
import { NetworkNode } from '@interfaces/IGlobalNetworkService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/IMetagraphService';
import ISeedlistService from '@interfaces/ISeedlistService';
import ISshService from '@interfaces/ISshService';

import waitForNode from '../utils/wait-for-node';

export class DataL1 {
  public sshService: ISshService;
  public metagraphService: IMetagraphService;
  public seedlistService: ISeedlistService;

  public metagraphNode: MetagraphNode;
  public referenceMetagraphNode: MetagraphNode;
  public referenceSourceNode: NetworkNode;
  public logName: string;

  constructor(
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceMetagraphNode: MetagraphNode,
    referenceSourceNode: NetworkNode,
    logName: string,
  ) {
    this.sshService = sshService;
    this.metagraphService = metagraphService;
    this.seedlistService = seedlistService;
    this.metagraphNode = sshService.metagraphNode;
    this.referenceMetagraphNode = referenceMetagraphNode;
    this.referenceSourceNode = referenceSourceNode;
    this.logName = logName;
  }

  private log(message: string) {
    console.log(`[dl1] ${message}`);
  }

  private async buildNodeEnvVariables() {
    const {
      name: keyStore,
      alias: keyAlias,
      password,
    } = this.metagraphNode.key_file;

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

    const { ip: referenceMl0Ip } = this.referenceMetagraphNode;

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
      this.metagraphNode,
      this.referenceSourceNode,
      this.logName,
    );
    await validatorDl1.startValidatorNodeDl1();
    await waitForNode(validatorDl1.metagraphNode, 'dl1', 'ReadyToJoin');
    await validatorDl1.joinNodeToCluster(this.metagraphNode);
  }

  private async updateSeedlist(
    seedlistUrl?: string,
    seedlistFileName?: string,
  ) {
    if (!seedlistUrl) {
      this.log('Node does not have seedlist set');
      return;
    }

    this.log(`Updating seedlist on node`);
    const command = `
    cd data-l1
    wget -O ${seedlistFileName} ${seedlistUrl}
    `;

    await this.sshService.executeCommand(command);
  }

  async startInitialValidatorDl1() {
    this.log(`Starting node ${this.metagraphNode.ip} as initial validator`);
    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('dl1');
    const command = await this.buildNodeEnvVariables();
    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command} 
    ${
      url
        ? `nohup java -jar data-l1.jar run-initial-validator --ip ${this.metagraphNode.ip} --seedlist ${fileName} > data-l1-startup.log 2>&1 &`
        : `nohup java -jar data-l1.jar run-initial-validator --ip ${this.metagraphNode.ip} > data-l1-startup.log 2>&1 &`
    }
    `;

    await this.sshService.executeCommand(parsedCommand);
    this.log(`Finished ${this.metagraphNode.ip} node as rollback`);
  }

  async startValidatorNodeDl1() {
    this.log(`Starting node ${this.metagraphNode.ip} as validator`);
    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('dl1');

    const command = await this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command}
    ${
      url
        ? `nohup java -jar data-l1.jar run-validator --ip ${this.metagraphNode.ip} --seedlist ${fileName} > data-l1-startup.log 2>&1 &`
        : `nohup java -jar data-l1.jar run-validator --ip ${this.metagraphNode.ip} > data-l1-startup.log 2>&1 &`
    }
    `;

    await this.sshService.executeCommand(parsedCommand);
    this.log(`Finished ${this.metagraphNode.ip} node as validator`);
  }

  async joinNodeToCluster(referenceMetagraphNode: MetagraphNode) {
    this.log(
      `Joining node ${this.metagraphNode.ip} to the node ${referenceMetagraphNode.ip}`,
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

    console.log(`Joining to node ${JSON.stringify(nodeInfo)}`);

    await this.sshService.executeCommand(command);
    this.log(
      `Finished joining node ${this.metagraphNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );
  }

  async startCluster(validatorHosts: ISshService[]) {
    await this.startInitialValidatorDl1();
    await waitForNode(this.metagraphNode, 'dl1', 'Ready');
    const promises = [];
    for (const validatorHost of validatorHosts) {
      promises.push(this.startAndJoinValidator(validatorHost));
    }
    await Promise.all(promises);
  }
}
