import { program } from 'commander';

import config from '@config/config.json';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import CheckMetagraphHealth from '@jobs/check-metagraph-health/CheckMetagraphHealth';
import ConstellationGlobalNetworkService from '@services/global-network/ConstellationGlobalNetworkService';
import { ConsoleLoggerService } from '@services/logger/ConsoleLoggerService';
import { FileLoggerService } from '@services/logger/FileLoggerService';
import ConstellationMetagraphService from '@services/metagraph/ConstellationMetagraphService';
import GithubSeedlistService from '@services/seedlist/GithubSeedlistService';
import { Ssh2Service } from '@services/ssh/Ssh2Service';

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
  for (let idx = 0; idx < metagraphNodes.length; idx++) {
    logger.info(`Starting ssh connection to node ${idx + 1}`);
    const sshService = new Ssh2Service(
      idx + 1,
      metagraphNodes[idx],
      logger,
      `/home/${metagraphNodes[idx].username}/code`,
    );

    await sshService.setConnection();
    sshServices.push(sshService);
  }

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
  const githubSeedlistService = new GithubSeedlistService(loggerService);
  const sshServices = await intializeSshConnections(loggerService);
  try {
    const checkMetagraphHealth = new CheckMetagraphHealth(
      sshServices,
      metagraphService,
      globalNetworkService,
      githubSeedlistService,
      loggerService,
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

checkMetagraphHealth();
