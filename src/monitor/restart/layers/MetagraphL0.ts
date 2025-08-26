import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Layers, NodeStatuses } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import sleep from '../utils/sleep';
import waitForNode from '../utils/wait-for-node';

export class MetagraphL0 {
  private monitoringConfiguration: MonitoringConfiguration;

  config: Config;
  sshService: ISshService;
  metagraphService: IMetagraphService;
  seedlistService: ISeedlistService;
  allowanceListService: IAllowanceListService;
  loggerService: ILoggerService;

  currentNode: MetagraphNode;
  referenceSourceNode: NetworkNode;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    sshService: ISshService,
    referenceSourceNode: NetworkNode,
  ) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.config = monitoringConfiguration.config;
    this.sshService = sshService;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.seedlistService = monitoringConfiguration.seedlistService;
    this.allowanceListService = monitoringConfiguration.allowanceListService;
    this.loggerService = monitoringConfiguration.loggerService;

    this.currentNode = sshService.metagraphNode;
    this.referenceSourceNode = referenceSourceNode;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[Metagraph L0] ${message}`);
  }

  private buildNodeEnvVariables() {
    const {
      name: keyStore,
      alias: keyAlias,
      password,
    } = this.currentNode.key_file;
    const {
      public: publicPort,
      p2p: p2pPort,
      cli: cliPort,
    } = this.config.metagraph.layers.ml0.ports;
    const {
      ip: referenceIp,
      port: referecePort,
      id: referenceId,
    } = this.referenceSourceNode;

    const additionalEnvVariables =
      this.config.metagraph.layers.ml0.additional_env_variables
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
    export CL_L0_TOKEN_IDENTIFIER=${this.config.metagraph.id} 
    export CL_APP_ENV=${this.config.network.name} 
    export CL_COLLATERAL=0
    ${additionalEnvVariables}
    cd metagraph-l0 
    `;
  }

  private async startAndJoinValidator(validatorHost: ISshService) {
    const validatorMl0 = new MetagraphL0(
      this.monitoringConfiguration,
      validatorHost,
      this.referenceSourceNode,
    );
    await sleep(5 * 1000);
    await validatorMl0.startValidatorNodeL0();
    await waitForNode(
      this.config,
      validatorMl0.currentNode,
      Layers.ML0,
      NodeStatuses.READY_TO_JOIN,
      this.loggerService,
    );
    await sleep(5 * 1000);
    await validatorMl0.joinNodeToCluster(this.currentNode);
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
    cd metagraph
    wget -O ${seedlistFileName} ${seedlistUrl}
    `;

    await this.sshService.executeCommand(command);
  }

  private async updateAllowanceList(
    allowanceListUrl?: string,
    allowanceListFileName?: string,
  ) {
    if (!allowanceListUrl) {
      this.customLogger('Node does not have allowance list set');
      return;
    }

    this.customLogger(`Updating allowance list on node`);
    const command = `
    cd currency-l1
    wget -O ${allowanceListFileName} ${allowanceListUrl}
    `;

    await this.sshService.executeCommand(command);
  }

  async startRollbackNodeL0() {
    this.customLogger(`Starting node ${this.currentNode.ip} as rollback`);

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation(Layers.ML0);

    const { url: allowanceListUrl, fileName: allowanceListFileName } =
      await this.allowanceListService.buildAllowanceListformation(Layers.ML0);

    const command = this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);
    await this.updateAllowanceList(allowanceListUrl, allowanceListFileName);

    const args = [
      `nohup java -jar metagraph-l0.jar run-rollback`,
      `--ip ${this.currentNode.ip}`,
      url ? `--seedlist ${fileName}` : '',
      allowanceListUrl ? `--allowanceList ${allowanceListFileName}` : '',
      `> metagraph-l0-startup.log 2>&1 &`,
    ]
      .filter(Boolean)
      .join(' ');

    const parsedCommand = `${command} ${args}`;

    await this.sshService.executeCommand(parsedCommand);

    this.customLogger(`Finished ${this.currentNode.ip} node as rollback`);
  }

  async startValidatorNodeL0() {
    this.customLogger(`Starting node ${this.currentNode.ip} as validator`);

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation(Layers.ML0);

    const { url: allowanceListUrl, fileName: allowanceListFileName } =
      await this.allowanceListService.buildAllowanceListformation(Layers.ML0);

    const command = this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);
    await this.updateAllowanceList(allowanceListUrl, allowanceListFileName);

    const args = [
      `nohup java -jar metagraph-l0.jar run-validator`,
      `--ip ${this.currentNode.ip}`,
      url ? `--seedlist ${fileName}` : '',
      allowanceListUrl ? `--allowanceList ${allowanceListFileName}` : '',
      `> metagraph-l0-startup.log 2>&1 &`,
    ]
      .filter(Boolean)
      .join(' ');

    const parsedCommand = `${command} ${args}`;

    await this.sshService.executeCommand(parsedCommand);

    this.customLogger(`Finished ${this.currentNode.ip} node as validator`);
  }

  async joinNodeToCluster(referenceMetagraphNode: MetagraphNode) {
    this.customLogger(
      `Joining node ${this.currentNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );

    const { ip: referenceIp } = referenceMetagraphNode;
    const { public: publicPort, cli: cliPort } =
      this.config.metagraph.layers.ml0.ports;

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

    this.customLogger(`Joining to node ${JSON.stringify(nodeInfo)}`);

    await this.sshService.executeCommand(command);

    this.customLogger(
      `Finished joining node ${this.currentNode.ip} to the node ${referenceMetagraphNode.ip}`,
    );
  }

  async startCluster(validatorHosts: ISshService[]) {
    await this.startRollbackNodeL0();
    await waitForNode(
      this.config,
      this.currentNode,
      Layers.ML0,
      NodeStatuses.READY,
      this.loggerService,
    );

    for (const validatorHost of validatorHosts) {
      await this.startAndJoinValidator(validatorHost);
    }
  }
}
