import IAlertCondition from '@interfaces/alert-conditions/IAlertCondition';
import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IAllowanceListService from '@interfaces/services/allowance-list/IAllowanceListService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import INotificationService from '@interfaces/services/notification/INotificationService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import NoAlertsService from '@services/alert/NoAlertsService';
import NoAllowanceListService from '@services/allowance-list/NoAllowanceListService';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import NoRebootService from '@services/instance-reboot/NoRebootService';
import ConsoleLoggerService from '@services/logger/ConsoleLoggerService';
import FileLoggerService from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import NoNotificationService from '@services/notification/NoNotificationService';
import NoSeedlistService from '@services/seedlist/NoSeedlistService';

import { IInstanceRebootService } from './interfaces';
import DiskSpaceLimit from './monitor/alert/conditions/DiskSpaceLimit';
import OwnerWalletOutOfFunds from './monitor/alert/conditions/OwnerWalletOutOfFunds';
import ForkedCluster from './monitor/restart/conditions/ForkedCluster';
import L0ForkedNodes from './monitor/restart/conditions/L0ForkedNodes';
import SnapshotsStopped from './monitor/restart/conditions/SnapshotsStopped';
import UnhealthyNodes from './monitor/restart/conditions/UnhealthyNodes';
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
  instance_id?: string;
};

// Input types (what users provide in config JSON - optional fields have defaults)
type MetagraphLayerInput = {
  ignore_layer?: boolean;
  ports: {
    public: number;
    p2p: number;
    cli: number;
  };
  additional_env_variables?: string[];
  seedlist?: unknown;
  allowance_list?: unknown;
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

// Config input type (what users provide in JSON - optional fields have defaults)
type ConfigInput = {
  metagraph: {
    id: string;
    name: string;
    version?: string;
    default_restart_conditions?: string[];
    default_alert_conditions?: string[];
    layers: {
      ml0: MetagraphLayerInput;
      cl1: MetagraphLayerInput;
      dl1: MetagraphLayerInput;
    };
    nodes: MetagraphNodesProps[];
  };
  network: NetworkProps;
  check_healthy_interval_in_minutes?: number;
  min_disk_space_percent?: number;
  min_owner_wallet_balance?: number;
};

type ResolvedLayerProps = {
  ignore_layer: boolean;
  ports: { public: number; p2p: number; cli: number };
  additional_env_variables: string[];
  seedlist: unknown;
  allowance_list: unknown;
};

// Resolved config (after defaults applied - all fields guaranteed present)
export type Config = {
  metagraph: {
    id: string;
    name: string;
    version: string;
    default_restart_conditions: string[];
    default_alert_conditions: string[];
    layers: {
      ml0: ResolvedLayerProps;
      cl1: ResolvedLayerProps;
      dl1: ResolvedLayerProps;
    };
    nodes: MetagraphNodesProps[];
  };
  network: NetworkProps;
  check_healthy_interval_in_minutes: number;
  min_disk_space_percent: number;
  min_owner_wallet_balance: number;
};

const DEFAULT_RESTART_CONDITIONS = [
  'SnapshotsStopped',
  'UnhealthyNodes',
  'L0ForkedNodes',
  'ForkedCluster',
];

const DEFAULT_ALERT_CONDITIONS = ['DiskSpaceLimit', 'OwnerWalletOutOfFunds'];

function applyLayerDefaults(layer: MetagraphLayerInput): ResolvedLayerProps {
  return {
    ignore_layer: layer.ignore_layer ?? false,
    ports: layer.ports,
    additional_env_variables: layer.additional_env_variables ?? [],
    seedlist: layer.seedlist ?? {},
    allowance_list: layer.allowance_list ?? {},
  };
}

function applyConfigDefaults(raw: ConfigInput): Config {
  return {
    metagraph: {
      id: raw.metagraph.id,
      name: raw.metagraph.name,
      version: raw.metagraph.version ?? '1.0.0',
      default_restart_conditions:
        raw.metagraph.default_restart_conditions ?? DEFAULT_RESTART_CONDITIONS,
      default_alert_conditions:
        raw.metagraph.default_alert_conditions ?? DEFAULT_ALERT_CONDITIONS,
      layers: {
        ml0: applyLayerDefaults(raw.metagraph.layers.ml0),
        cl1: applyLayerDefaults(raw.metagraph.layers.cl1),
        dl1: applyLayerDefaults(raw.metagraph.layers.dl1),
      },
      nodes: raw.metagraph.nodes,
    },
    network: raw.network,
    check_healthy_interval_in_minutes:
      raw.check_healthy_interval_in_minutes ?? 5,
    min_disk_space_percent: raw.min_disk_space_percent ?? 10,
    min_owner_wallet_balance: raw.min_owner_wallet_balance ?? 10,
  };
}

export class MonitoringConfiguration {
  public config: Config;
  public sshServices: ISshService[];
  public metagraphService: IMetagraphService;
  public globalNetworkService: IGlobalNetworkService;
  public seedlistService: ISeedlistService;
  public allowanceListService: IAllowanceListService;
  public loggerService: ILoggerService;
  public alertService: IAlertService;
  public notificationService: INotificationService;
  public instanceRebootService: IInstanceRebootService;
  private restartConditions: IRestartCondition[];
  private alertConditions: IAlertCondition[];

  constructor(
    config: Config | ConfigInput,
    devMode: boolean = false,
    services?: {
      loggerService?: ILoggerService;
      sshServices?: ISshService[];
      metagraphService?: IMetagraphService;
      globalNetworkService?: IGlobalNetworkService;
      seedlistService?: ISeedlistService;
      allowanceListService?: IAllowanceListService;
      alertService?: IAlertService;
      notificationService?: INotificationService;
    },
    customRestartConditions?: IRestartCondition[],
    customAlertConditions?: IAlertCondition[],
    customInstanceReboot?: IInstanceRebootService,
  ) {
    this.config = applyConfigDefaults(config);

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

    this.notificationService =
      services?.notificationService ?? new NoNotificationService(this);

    this.restartConditions = this.buildRestartConditions(
      customRestartConditions,
    );

    this.alertConditions = this.buildAlertConditions(customAlertConditions);

    this.instanceRebootService =
      customInstanceReboot ?? new NoRebootService(this);
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

    if (default_restart_conditions.includes('L0ForkedNodes')) {
      restartConditions.push(new L0ForkedNodes(this));
    }

    if (default_restart_conditions.includes('ForkedCluster')) {
      restartConditions.push(new ForkedCluster(this));
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

  getInstanceReboot(): IInstanceRebootService {
    return this.instanceRebootService;
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
