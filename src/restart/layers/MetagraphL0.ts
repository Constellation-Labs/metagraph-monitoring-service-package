import config from '@config/config.json';
import { NetworkNode } from '@interfaces/global-network/types';
import IMetagraphService from '@interfaces/metagraph/IMetagraphService';
import { MetagraphNode } from '@interfaces/metagraph/types';
import ISeedlistService from '@interfaces/seedlist/ISeedlistService';
import ISshService from '@interfaces/ssh/ISshService';

import waitForNode from '../utils/wait-for-node';

export class MetagraphL0 {
  public sshService: ISshService;
  public metagraphService: IMetagraphService;
  public seedlistService: ISeedlistService;
  public metagraphNode: MetagraphNode;
  public referenceSourceNode: NetworkNode;
  public logName: string;

  constructor(
    sshService: ISshService,
    metagraphService: IMetagraphService,
    seedlistService: ISeedlistService,
    referenceSourceNode: NetworkNode,
    logName: string,
  ) {
    this.sshService = sshService;
    this.metagraphService = metagraphService;
    this.metagraphNode = sshService.metagraphNode;
    this.referenceSourceNode = referenceSourceNode;
    this.logName = logName;
    this.seedlistService = seedlistService;
  }

  private log(message: string) {
    console.log(`[ml0] ${message}`);
  }

  private buildNodeEnvVariables() {
    const {
      name: keyStore,
      alias: keyAlias,
      password,
    } = this.metagraphNode.key_file;
    const {
      public: publicPort,
      p2p: p2pPort,
      cli: cliPort,
    } = config.metagraph.layers.ml0.ports;
    const {
      ip: referenceIp,
      port: referecePort,
      id: referenceId,
    } = this.referenceSourceNode;

    const additionalEnvVariables =
      config.metagraph.layers.ml0.additional_env_variables
        .map((envVariable) => `export ${envVariable}`)
        .join('\n');

    return `
    export CL_KEYSTORE="${keyStore}" 
    export CL_KEYALIAS="${keyAlias}" 
    export CL_PASSWORD="${password}" 
    export CL_PUBLIC_HTTP_PORT=${publicPort} 
    export CL_P2P_HTTP_PORT=${p2pPort} 
    export CL_CLI_HTTP_PORT=${cliPort} 
    export CL_GLOBAL_L0_PEER_HTTP_HOST=${referenceIp} 
    export CL_GLOBAL_L0_PEER_HTTP_PORT=${referecePort} 
    export CL_GLOBAL_L0_PEER_ID=${referenceId} 
    export CL_L0_TOKEN_IDENTIFIER=${config.metagraph.id} 
    export CL_APP_ENV=${config.network.name} 
    export CL_COLLATERAL=0
    ${additionalEnvVariables}
    cd metagraph-l0 
    `;
  }

  private async startAndJoinValidator(validatorHost: ISshService) {
    const validatorMl0 = new MetagraphL0(
      validatorHost,
      this.metagraphService,
      this.seedlistService,
      this.referenceSourceNode,
      this.logName,
    );
    await validatorMl0.startValidatorNodeL0();
    await waitForNode(validatorMl0.metagraphNode, 'ml0', 'ReadyToJoin');
    await validatorMl0.joinNodeToCluster(this.metagraphNode);
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
    cd metagraph
    wget -O ${seedlistFileName} ${seedlistUrl}
    `;

    await this.sshService.executeCommand(command);
  }

  async startRollbackNodeL0() {
    this.log(`Starting node ${this.metagraphNode.ip} as rollback`);
    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('ml0');

    const command = this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command} 
    ${
      url
        ? `nohup java -jar metagraph-l0.jar run-rollback --ip ${this.metagraphNode.ip} --seedlist ${fileName} > metagraph-l0-startup.log 2>&1 &`
        : `nohup java -jar metagraph-l0.jar run-rollback --ip ${this.metagraphNode.ip} > metagraph-l0-startup.log 2>&1 &`
    }
    `;

    await this.sshService.executeCommand(parsedCommand);
    this.log(`Finished ${this.metagraphNode.ip} node as rollback`);
  }

  async startValidatorNodeL0() {
    this.log(`Starting node ${this.metagraphNode.ip} as validator`);
    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation('ml0');

    const command = this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);

    const parsedCommand = ` ${command} 
    ${
      url
        ? `nohup java -jar metagraph-l0.jar run-validator --ip ${this.metagraphNode.ip} --seedlist ${fileName} > metagraph-l0-startup.log 2>&1 &`
        : `nohup java -jar metagraph-l0.jar run-validator --ip ${this.metagraphNode.ip} > metagraph-l0-startup.log 2>&1 &`
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
      config.metagraph.layers.ml0.ports;

    const nodeInfo = await this.metagraphService.getNodeInfo(
      referenceIp,
      publicPort,
    );
    if (!nodeInfo) {
      throw new Error(
        `Could not get node info of node ${referenceIp} on layer ml0`,
      );
    }
    const command = `
    cd metagraph-l0
    curl -v -X POST http://localhost:${cliPort}/cluster/join -H "Content-type: application/json" -d '{ "id":"${nodeInfo.id}", "ip": "${nodeInfo.host}", "p2pPort": ${nodeInfo.p2pPort} }'`;

    console.log(`Joining to node ${JSON.stringify(nodeInfo)}`);

    await this.sshService.executeCommand(command);
    this.log(
      `Finished joining node ${this.metagraphNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );
  }

  async startCluster(validatorHosts: ISshService[]) {
    await this.startRollbackNodeL0();
    await waitForNode(this.metagraphNode, 'ml0', 'Ready');
    const promises = [];
    for (const validatorHost of validatorHosts) {
      promises.push(this.startAndJoinValidator(validatorHost));
    }
    await Promise.all(promises);
  }
}
