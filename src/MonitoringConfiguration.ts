import IAlertCondition from '@interfaces/alert-conditions/IAlertCondition';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import NoAlertsService from '@services/alert/NoAlertsService';
import NoAllowanceListService from '@services/allowance-list/NoAllowanceListService';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import ConsoleLoggerService from '@services/logger/ConsoleLoggerService';
import FileLoggerService from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import NoSeedlistService from '@services/seedlist/NoSeedlistService';

import DiskSpaceLimit from './monitor/alert/conditions/DiskSpaceLimit';
import OwnerWalletOutOfFunds from './monitor/alert/conditions/OwnerWalletOutOfFunds';
import SnapshotsStopped from './monitor/restart/conditions/SnapshotsStopped';
import UnhealthyNodes from './monitor/restart/conditions/UnhealthyNodes';
import { Ssh2Service } from './services';

type MetagraphNodesProps = {
  ip: string;
  username: string;
  password?: string;
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
  allowance_list: unknown;
};

type MetagraphProps = {
  id: string;
  name: string;
  version: string;
  default_restart_conditions: string[];
  default_alert_conditions?: string[];
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

export type Config = {
  metagraph: MetagraphProps;
  network: NetworkProps;
  check_healthy_interval_in_minutes: number;
  min_disk_space_percent?: number;
  min_owner_wallet_balance?: number;
};

export class MonitoringConfiguration {
  public config: Config;
  public sshServices: ISshService[];
  public metagraphService: IMetagraphService;
  public globalNetworkService: IGlobalNetworkService;
  public seedlistService: ISeedlistService;
  public allowanceListService: IAllowanceListService;
  public loggerService: ILoggerService;
  public alertService: IAlertService;
  private restartConditions: IRestartCondition[];
  private alertConditions: IAlertCondition[];

  constructor(
    config: Config,
    devMode: boolean = false,
    services?: {
      loggerService?: ILoggerService;
      sshServices?: ISshService[];
      metagraphService?: IMetagraphService;
      globalNetworkService?: IGlobalNetworkService;
      seedlistService?: ISeedlistService;
      allowanceListService?: IAllowanceListService;
      alertService?: IAlertService;
    },
    customRestartConditions?: IRestartCondition[],
    customAlertConditions?: IAlertCondition[],
  ) {
    this.config = config;

    this.loggerService =
      services?.loggerService ?? devMode
        ? new ConsoleLoggerService()
        : new FileLoggerService();

    this.sshServices =
      services?.sshServices ?? this.buildSshServices(this.loggerService);

    this.metagraphService =
      services?.metagraphService ?? new ConstellationMetagraphService(this);

    this.globalNetworkService =
      services?.globalNetworkService ??
      new ConstellationGlobalNetworkService(this);

    this.seedlistService =
      services?.seedlistService ?? new NoSeedlistService(this);

    this.allowanceListService =
      services?.allowanceListService ?? new NoAllowanceListService(this);

    this.alertService = services?.alertService ?? new NoAlertsService(this);

    this.restartConditions = this.buildRestartConditions(
      customRestartConditions,
    );

    this.alertConditions = this.buildAlertConditions(customAlertConditions);
  }

  private buildSshServices(logger: ILoggerService): ISshService[] {
    const { nodes: metagraphNodes } = this.config.metagraph;
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
    let restartConditions = [];

    const { default_restart_conditions } = this.config.metagraph;
    if (default_restart_conditions.includes('SnapshotsStopped')) {
      restartConditions.push(new SnapshotsStopped(this));
    }

    if (default_restart_conditions.includes('UnhealthyNodes')) {
      restartConditions.push(new UnhealthyNodes(this));
    }

    if (customRestartConditions) {
      restartConditions = [...restartConditions, ...customRestartConditions];
    }

    return restartConditions;
  }

  setRestartConditions(customRestartConditions?: IRestartCondition[]) {
    this.restartConditions = this.buildRestartConditions(
      customRestartConditions,
    );
  }

  getRestartConditions(): IRestartCondition[] {
    return this.restartConditions;
  }

  private buildAlertConditions(
    customAlertConditions?: IAlertCondition[],
  ): IAlertCondition[] {
    let alertConditions = [];

    const { default_alert_conditions } = this.config.metagraph;
    if (
      default_alert_conditions &&
      default_alert_conditions.includes('DiskSpaceLimit')
    ) {
      alertConditions.push(new DiskSpaceLimit(this));
    }

    if (
      default_alert_conditions &&
      default_alert_conditions.includes('OwnerWalletOutOfFunds')
    ) {
      alertConditions.push(new OwnerWalletOutOfFunds(this));
    }

    if (customAlertConditions) {
      alertConditions = [...alertConditions, ...customAlertConditions];
    }

    return alertConditions;
  }

  setAlertConditions(customAlertConditions?: IAlertCondition[]) {
    this.alertConditions = this.buildAlertConditions(customAlertConditions);
  }

  getAlertConditions(): IAlertCondition[] {
    return this.alertConditions;
  }
}
