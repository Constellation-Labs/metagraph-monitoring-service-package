import { program } from 'commander';

import config from '@config/config.json';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import CheckMetagraphHealth from '@jobs/check-metagraph-health/CheckMetagraphHealth';
import { NoAlertsService } from '@services/alert/NoAlertsService';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import { ConsoleLoggerService } from '@services/logger/ConsoleLoggerService';
import { FileLoggerService } from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import NoSeedlistService from '@services/seedlist/NoSeedlistService';
import { Ssh2Service } from '@services/ssh/Ssh2Service';
import { NetworkNames } from '@shared/constants';

program
  .version('1.0.0')
  .option('-fr, --force_restart', 'Force complete metagraph restart', false)
  .option('-d, --dev_mode', 'Start application in dev mode', false);

program.parse(process.argv);
const options = program.opts();

const intializeSshConnections = async (
  logger: ILoggerService,
): Promise<ISshService[]> => {
  const { nodes: metagraphNodes } = config.metagraph;
  const sshServices: ISshService[] = [];
  logger.info(
    `##################### INITIALIZING SSH CONNECTIONS #####################`,
  );

  const promises = [];
  const initializeSshConnection = async (idx: number) => {
    logger.info(`Starting ssh connection to node ${idx + 1}`);
    const sshService = new Ssh2Service(
      idx + 1,
      metagraphNodes[idx],
      logger,
      `/home/${metagraphNodes[idx].username}/code`,
    );

    await sshService.setConnection();
    sshServices.push(sshService);
  };

  for (let idx = 0; idx < metagraphNodes.length; idx++) {
    promises.push(initializeSshConnection(idx));
  }

  await Promise.all(promises);

  return sshServices;
};

const finishSshConnections = async (
  sshServices: ISshService[],
  logger: ILoggerService,
) => {
  logger.info(
    `##################### FINISHING SSH CONNECTIONS #####################`,
  );
  const ssh2Services: Ssh2Service[] = sshServices as Ssh2Service[];
  for (const sshService of ssh2Services) {
    (await sshService.connection).destroy();
  }
};

const checkMetagraphHealth = async () => {
  const { name, nodes } = config.network;
  const loggerService = options.dev_mode
    ? new ConsoleLoggerService()
    : new FileLoggerService();
  const metagraphService = new ConstellationMetagraphService(loggerService);
  const globalNetworkService = new ConstellationGlobalNetworkService(
    name,
    nodes,
    loggerService,
  );
  const githubSeedlistService = new NoSeedlistService(loggerService);
  const sshServices = await intializeSshConnections(loggerService);
  const alertService = await new NoAlertsService(loggerService);

  try {
    const checkMetagraphHealth = new CheckMetagraphHealth(
      sshServices,
      metagraphService,
      globalNetworkService,
      githubSeedlistService,
      loggerService,
      alertService,
      options.force_restart,
    );

    await checkMetagraphHealth.execute();
  } catch (e) {
    loggerService.error(`Error when executing checkMetagraphHealth ${e}`);
  } finally {
    await finishSshConnections(sshServices, loggerService);
  }
  return;
};

async function periodicJob() {
  const validNetworkNames: NetworkNames[] = [
    'mainnet',
    'integrationnet',
    'testnet',
  ];

  if (!validNetworkNames.includes(config.network.name as NetworkNames)) {
    throw Error('Invalid network');
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await checkMetagraphHealth();
      options.force_restart = false;
    } catch (error) {
      continue;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, config.check_healthy_interval_in_minutes * 60 * 1000),
    );
  }
}

periodicJob();
