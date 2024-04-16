import IRestartCondition from '@interfaces/restart-conditions/IRestartCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import IMetagraphService from '@interfaces/services/metagraph/IMetagraphService';
import ISeedlistService from '@interfaces/services/seedlist/ISeedlistService';
import ISshService from '@interfaces/services/ssh/ISshService';
import CheckMetagraphHealth from '@jobs/check-metagraph-health/CheckMetagraphHealth';
import SnapshotsStopped from '@jobs/check-metagraph-health/restart/conditions/SnapshotsStopped';
import UnhealthyNodes from '@jobs/check-metagraph-health/restart/conditions/UnhealthyNodes';
import { NoAlertsService } from '@services/alert/NoAlertsService';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import { FileLoggerService } from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import NoSeedlistService from '@services/seedlist/NoSeedlistService';
import { Ssh2Service } from '@services/ssh/Ssh2Service';

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

type Configs = {
  metagraph: MetagraphProps;
  network: NetworkProps;
  check_healthy_interval_in_minutes: number;
};

export default class MonitoringApp {
  private configs: Configs;
  private sshServices: ISshService[];
  private metagraphService: IMetagraphService;
  private globalNetworkService: IGlobalNetworkService;
  private seedlistService: ISeedlistService;
  private logger: ILoggerService;
  private alertService: IAlertService;
  private forceRestart: boolean;
  private restartConditions: IRestartCondition[];

  constructor(
    configs: Configs,
    forceRestart: boolean = false,
    services?: {
      logger?: ILoggerService;
      sshServices?: ISshService[];
      metagraphService?: IMetagraphService;
      globalNetworkService?: IGlobalNetworkService;
      seedlistService?: ISeedlistService;
      alertService?: IAlertService;
      restartConditions?: IRestartCondition[];
    },
  ) {
    this.configs = configs;

    this.forceRestart = forceRestart;

    this.logger = services?.logger ?? new FileLoggerService();

    this.sshServices =
      services?.sshServices ?? this.buildSshServices(this.logger);

    this.metagraphService =
      services?.metagraphService ??
      new ConstellationMetagraphService(this.logger);

    this.globalNetworkService =
      services?.globalNetworkService ??
      new ConstellationGlobalNetworkService(
        this.configs.network.name,
        this.configs.network.nodes,
        this.logger,
      );

    this.seedlistService =
      services?.seedlistService ?? new NoSeedlistService(this.logger);

    this.alertService =
      services?.alertService ?? new NoAlertsService(this.logger);

    this.restartConditions = services?.restartConditions ?? [
      new SnapshotsStopped(
        this.sshServices,
        this.metagraphService,
        this.globalNetworkService,
        this.seedlistService,
        this.logger,
      ),
      new UnhealthyNodes(
        this.sshServices,
        this.metagraphService,
        this.globalNetworkService,
        this.seedlistService,
        this.logger,
      ),
    ];
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

  private async initializeSshConnections() {
    await Promise.all(
      this.sshServices.map((sshService) => sshService.setConnection()),
    );
  }

  private async finishSshConnections() {
    await Promise.all(
      this.sshServices.map((sshService) => sshService.destroyConnection()),
    );
  }

  public setForceRestart(value: boolean) {
    this.forceRestart = value;
  }

  public async checkMetagraphHealth() {
    try {
      await this.initializeSshConnections();
      const checkMetagraphHealth = new CheckMetagraphHealth(
        this.sshServices,
        this.metagraphService,
        this.globalNetworkService,
        this.seedlistService,
        this.logger,
        this.alertService,
        this.forceRestart,
        this.restartConditions,
      );
      await checkMetagraphHealth.execute();
    } catch (e) {
      this.logger.error(`Error when executing checkMetagraphHealth: ${e}`);
    } finally {
      await this.finishSshConnections();
    }
  }
}

export type {
  IRestartCondition,
  IAlertService,
  IGlobalNetworkService,
  ILoggerService,
  IMetagraphService,
  ISeedlistService,
  ISshService,
};
