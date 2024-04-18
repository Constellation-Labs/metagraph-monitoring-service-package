import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import NoAlertsService from '@services/alert/NoAlertsService';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import ConsoleLoggerService from '@services/logger/ConsoleLoggerService';
import FileLoggerService from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import NoSeedlistService from '@services/seedlist/NoSeedlistService';
import { NetworkNames } from '@shared/constants';

import SnapshotsStopped from './check-metagraph-health/restart/conditions/SnapshotsStopped';
import UnhealthyNodes from './check-metagraph-health/restart/conditions/UnhealthyNodes';
import { Ssh2Service } from './services';

type MetagraphNodesProps = {
  ip: string;
  username: string;
  privateKeyPath: string;
  key_file: {
    name: string;
    alias: string;
    password: string;
  };
};

type MetagraphLayerProps = {
  ignore_layer: boolean;
  ports: {
    public: number;
    p2p: number;
    cli: number;
  };
  additional_env_variables: string[];
  seedlist: unknown;
};

type MetagraphProps = {
  id: string;
  name: string;
  version: string;
  default_restart_conditions: string[];
  layers: {
    ml0: MetagraphLayerProps;
    cl1: MetagraphLayerProps;
    dl1: MetagraphLayerProps;
  };
  nodes: MetagraphNodesProps[];
};

type NetworkNode = {
  ip: string;
  port: number;
  id: string;
};

type NetworkProps = {
  name: string;
  nodes: NetworkNode[];
};

export type Configs = {
  metagraph: MetagraphProps;
  network: NetworkProps;
  check_healthy_interval_in_minutes: number;
};

export class MonitoringConfiguration {
  public configs: Configs;
  public sshServices: ISshService[];
  public metagraphService: IMetagraphService;
  public globalNetworkService: IGlobalNetworkService;
  public seedlistService: ISeedlistService;
  public logger: ILoggerService;
  public alertService: IAlertService;
  public restartConditions: IRestartCondition[];

  constructor(
    configs: Configs,
    devMode: boolean = false,
    services?: {
      logger?: ILoggerService;
      sshServices?: ISshService[];
      metagraphService?: IMetagraphService;
      globalNetworkService?: IGlobalNetworkService;
      seedlistService?: ISeedlistService;
      alertService?: IAlertService;
    },
    customRestartConditions?: IRestartCondition[],
  ) {
    this.configs = configs;

    this.validateNetwork();

    this.logger =
      services?.logger ?? devMode
        ? new ConsoleLoggerService()
        : new FileLoggerService();

    this.sshServices =
      services?.sshServices ?? this.buildSshServices(this.logger);

    this.metagraphService =
      services?.metagraphService ?? new ConstellationMetagraphService(this);

    this.globalNetworkService =
      services?.globalNetworkService ??
      new ConstellationGlobalNetworkService(this);

    this.seedlistService =
      services?.seedlistService ?? new NoSeedlistService(this);

    this.alertService = services?.alertService ?? new NoAlertsService(this);

    this.restartConditions = this.buildRestartConditions(
      customRestartConditions,
    );
  }

  private buildSshServices(logger: ILoggerService): ISshService[] {
    const { nodes: metagraphNodes } = this.configs.metagraph;
    const sshServices: ISshService[] = [];
    for (let idx = 0; idx < metagraphNodes.length; idx++) {
      const sshService = new Ssh2Service(
        idx + 1,
        metagraphNodes[idx],
        logger,
        `/home/${metagraphNodes[idx].username}/code`,
      );
      sshServices.push(sshService);
    }

    return sshServices;
  }

  private buildRestartConditions(
    customRestartConditions?: IRestartCondition[],
  ): IRestartCondition[] {
    const restartConditions = customRestartConditions
      ? [...customRestartConditions]
      : [];

    const { default_restart_conditions } = this.configs.metagraph;
    if (default_restart_conditions.includes('SnapshotsStopped')) {
      restartConditions.push(new SnapshotsStopped(this));
    }

    if (default_restart_conditions.includes('UnhealthyNodes')) {
      restartConditions.push(new UnhealthyNodes(this));
    }

    return restartConditions;
  }

  private validateNetwork() {
    const validNetworkNames: NetworkNames[] = [
      'mainnet',
      'integrationnet',
      'testnet',
    ];

    if (
      !validNetworkNames.includes(this.configs.network.name as NetworkNames)
    ) {
      throw Error('Invalid network');
    }
  }
}
