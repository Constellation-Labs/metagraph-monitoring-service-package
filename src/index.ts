import config from '@config/config.json';
import ISshService from '@interfaces/services/ISshService';
import CheckMetagraphHealth from '@jobs/check-metagraph-health/CheckMetagraphHealth';
import ConstellationGlobalNetworkService from '@services/ConstellationGlobalNetworkService';
import ConstellationMetagraphService from '@services/ConstellationMetagraphService';
import GithubSeedlistService from '@services/GithubSeedlistService';
import { Ssh2Service } from '@services/Ssh2Service';

const intializeSshConnections = async (): Promise<ISshService[]> => {
  const { nodes: metagraphNodes } = config.metagraph;
  const sshServices: ISshService[] = [];

  for (let idx = 0; idx < metagraphNodes.length; idx++) {
    console.log(`Starting ssh connection to node ${idx + 1}`);
    const sshService = new Ssh2Service(
      idx + 1,
      metagraphNodes[idx],
      `/home/${metagraphNodes[idx].username}/code`,
    );

    await sshService.setConnection();
    sshServices.push(sshService);
  }

  return sshServices;
};

const finishSshConnections = async (sshServices: ISshService[]) => {
  const ssh2Services: Ssh2Service[] = sshServices as Ssh2Service[];
  for (const sshService of ssh2Services) {
    (await sshService.connection).destroy();
  }
};

const checkMetagraphHealth = async () => {
  const sshServices = await intializeSshConnections();
  const { name, nodes } = config.network;
  try {
    const checkMetagraphHealth = new CheckMetagraphHealth(
      sshServices,
      new ConstellationMetagraphService(),
      new ConstellationGlobalNetworkService(name, nodes),
      new GithubSeedlistService(),
    );
    await checkMetagraphHealth.execute();
  } catch (e) {
    console.log('Error');
  } finally {
    await finishSshConnections(sshServices);
  }
  return;
};

checkMetagraphHealth();
