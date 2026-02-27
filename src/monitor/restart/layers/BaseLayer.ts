import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import { NetworkNode } from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService, {
  MetagraphNode,
} from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, NodeStatuses } from '@shared/constants';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import sleep from '../utils/sleep';
import waitForNode from '../utils/wait-for-node';

export abstract class BaseLayer {
  protected monitoringConfiguration: MonitoringConfiguration;
  protected config: Config;
  protected sshService: ISshService;
  protected metagraphService: IMetagraphService;
  protected seedlistService: ISeedlistService;
  protected allowanceListService: IAllowanceListService;
  protected loggerService: ILoggerService;

  currentNode: MetagraphNode;
  referenceSourceNode: NetworkNode;

  abstract readonly layer: AvailableLayers;
  abstract readonly layerLabel: string;
  abstract readonly jarName: string;
  abstract readonly dirName: string;
  abstract readonly startupLogName: string;
  abstract readonly initialMode: string;

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

  protected log(message: string) {
    this.loggerService.info(`[${this.layerLabel}] ${message}`);
  }

  protected getLayerPorts() {
    return this.config.metagraph.layers[this.layer].ports;
  }

  protected buildBaseEnvVariables(): string {
    const {
      name: keyStore,
      alias: keyAlias,
      password,
    } = this.currentNode.key_file;
    const {
      public: publicPort,
      p2p: p2pPort,
      cli: cliPort,
    } = this.getLayerPorts();
    const {
      ip: referenceIp,
      port: referencePort,
      id: referenceId,
    } = this.referenceSourceNode;

    const additionalEnvVariables = this.config.metagraph.layers[
      this.layer
    ].additional_env_variables
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
    export CL_GLOBAL_L0_PEER_HTTP_PORT=${referencePort}
    export CL_GLOBAL_L0_PEER_ID=${referenceId}
    export CL_L0_TOKEN_IDENTIFIER=${this.config.metagraph.id}
    export CL_APP_ENV=${this.config.network.name}
    export CL_COLLATERAL=0
    ${additionalEnvVariables}`;
  }

  protected async buildLayerSpecificEnvVariables(): Promise<string> {
    return '';
  }

  protected async buildNodeEnvVariables(): Promise<string> {
    const baseEnv = this.buildBaseEnvVariables();
    const layerEnv = await this.buildLayerSpecificEnvVariables();

    return `${baseEnv}
    ${layerEnv}
    cd ${this.dirName}
    `;
  }

  protected async updateSeedlist(
    seedlistUrl?: string,
    seedlistFileName?: string,
  ) {
    if (!seedlistUrl) {
      this.log('Node does not have seedlist set');
      return;
    }

    this.log('Updating seedlist on node');
    const command = `
    cd ${this.dirName}
    wget -O ${seedlistFileName} ${seedlistUrl}
    `;
    await this.sshService.executeCommand(command);
  }

  protected async updateAllowanceList(
    allowanceListUrl?: string,
    allowanceListFileName?: string,
  ) {
    if (!allowanceListUrl) {
      this.log('Node does not have allowance list set');
      return;
    }

    this.log('Updating allowance list on node');
    const command = `
    cd ${this.dirName}
    wget -O ${allowanceListFileName} ${allowanceListUrl}
    `;
    await this.sshService.executeCommand(command);
  }

  protected buildJarArgs(
    mode: string,
    seedlistUrl?: string,
    seedlistFileName?: string,
    allowanceListUrl?: string,
    allowanceListFileName?: string,
  ): string {
    return [
      `nohup java -jar ${this.jarName} ${mode}`,
      `--ip ${this.currentNode.ip}`,
      seedlistUrl ? `--seedlist ${seedlistFileName}` : '',
      allowanceListUrl ? `--allowanceList ${allowanceListFileName}` : '',
      `> ${this.startupLogName} 2>&1 &`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  protected abstract createValidatorInstance(
    validatorHost: ISshService,
  ): BaseLayer;

  private async startAndJoinValidator(validatorHost: ISshService) {
    const validator = this.createValidatorInstance(validatorHost);
    await sleep(5 * 1000);
    await validator.startValidatorNode();
    await waitForNode(
      this.config,
      validator.currentNode,
      this.layer,
      NodeStatuses.READY_TO_JOIN,
      this.loggerService,
    );
    await sleep(5 * 1000);
    await validator.joinNodeToCluster(this.currentNode);
  }

  async startInitialNode() {
    this.log(`Starting node ${this.currentNode.ip} as ${this.initialMode}`);

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation(this.layer);
    const { url: allowanceListUrl, fileName: allowanceListFileName } =
      await this.allowanceListService.buildAllowanceListformation(this.layer);

    const envVars = await this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);
    await this.updateAllowanceList(allowanceListUrl, allowanceListFileName);

    const args = this.buildJarArgs(
      this.initialMode,
      url,
      fileName,
      allowanceListUrl,
      allowanceListFileName,
    );
    await this.sshService.executeCommand(`${envVars} ${args}`);

    this.log(`Completed ${this.currentNode.ip} node as ${this.initialMode}`);
  }

  async startValidatorNode() {
    this.log(`Starting node ${this.currentNode.ip} as validator`);

    const { url, fileName } =
      await this.seedlistService.buildSeedlistInformation(this.layer);
    const { url: allowanceListUrl, fileName: allowanceListFileName } =
      await this.allowanceListService.buildAllowanceListformation(this.layer);

    const envVars = await this.buildNodeEnvVariables();

    await this.updateSeedlist(url, fileName);
    await this.updateAllowanceList(allowanceListUrl, allowanceListFileName);

    const args = this.buildJarArgs(
      'run-validator',
      url,
      fileName,
      allowanceListUrl,
      allowanceListFileName,
    );
    await this.sshService.executeCommand(`${envVars} ${args}`);

    this.log(`Completed ${this.currentNode.ip} node as validator`);
  }

  async joinNodeToCluster(referenceMetagraphNode: MetagraphNode) {
    this.log(
      `Joining node ${this.currentNode.ip} to node ${referenceMetagraphNode.ip}`,
    );

    const { ip: referenceIp } = referenceMetagraphNode;
    const { public: publicPort, cli: cliPort } = this.getLayerPorts();

    const nodeInfo = await this.metagraphService.getNodeInfo(
      referenceIp,
      publicPort,
    );
    if (!nodeInfo) {
      throw new Error(
        `Could not get node info of node ${referenceIp} on layer ${this.layer}`,
      );
    }

    const command = `
    cd ${this.dirName}
    curl -v -X POST http://localhost:${cliPort}/cluster/join -H "Content-type: application/json" -d '{ "id":"${nodeInfo.id}", "ip": "${nodeInfo.host}", "p2pPort": ${nodeInfo.p2pPort} }'`;

    this.log(
      `Joining to node ${nodeInfo.id}@${nodeInfo.host}:${nodeInfo.p2pPort}`,
    );
    await this.sshService.executeCommand(command);

    this.log(
      `Completed joining node ${this.currentNode.ip} to node ${referenceMetagraphNode.ip}`,
    );
  }

  async startCluster(validatorHosts: ISshService[]) {
    await this.startInitialNode();
    await waitForNode(
      this.config,
      this.currentNode,
      this.layer,
      NodeStatuses.READY,
      this.loggerService,
    );

    for (const validatorHost of validatorHosts) {
      await this.startAndJoinValidator(validatorHost);
    }
  }
}
