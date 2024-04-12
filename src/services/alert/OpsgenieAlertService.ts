import axios from 'axios';

import config from '@config/config.json';
import IAlertService, {
  AlertType,
} from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';

type NetworkNames = 'mainnet' | 'integrationnet' | 'testnet';
export class OpsgenieAlertService implements IAlertService {
  logger: ILoggerService;

  private opsgenie_alert_url: string = 'https://api.opsgenie.com/v2/alerts';
  private opsgenie_api_key: string;

  private valid_network_tags_opsgenie = {
    mainnet: 'env:MainNet',
    integrationnet: 'env:IntegrationNet',
    testnet: 'env:TestNet',
  };

  constructor(logger: ILoggerService) {
    this.logger = logger;
    this.opsgenie_api_key = '';
  }

  private customLog(message: string) {
    this.logger.info(`[OpsgenieAlertService] ${message}`);
  }

  private async getOpsgenieApiKey(): Promise<string> {
    if (this.opsgenie_api_key) {
      return this.opsgenie_alert_url;
    }

    return '5abb65f3-2a0d-471b-91d1-ba8b54885454';
  }

  private buildStartedRestartAlertBody = (
    restartType: string,
    restartReason: string,
  ): object => {
    const { name: metagraphName, nodes: metagraphNodes, id } = config.metagraph;
    const { name: networkName } = config.network;

    const nodesInformation = metagraphNodes
      .map((node, idx) => {
        const nodeInfo = `
      Node ${idx + 1} - IP: ${node.ip}
      Metagraph L0 - http://${node.ip}:${config.metagraph.layers.ml0.ports.public}/node/info
      ${'cl1' in config.metagraph.layers ? `Currency L1 - http://${node.ip}:${config.metagraph.layers.cl1.ports.public}/node/info` : ''}
      ${'dl1' in config.metagraph.layers ? `Data L1 - http://${node.ip}:${config.metagraph.layers.dl1.ports.public}/node/info` : ''}
      `.trim();
        return nodeInfo;
      })
      .join('\n\n');

    return {
      message: `${metagraphName} Metagraph Started a Restart`,
      description: `
      The ${metagraphName} Metagraph started a restart on ${networkName}.
      Restart Type: ${restartType}
      Restart reason: ${restartReason}
      
      You can check the metagraph nodes on these URLs:
      ${nodesInformation}
      `,
      alias: `${id}_restart`,
      actions: ['Metagraph', 'Restart'],
      tags: [
        this.valid_network_tags_opsgenie[networkName as NetworkNames] || '',
      ],
      details: {
        metagraphId: id,
        network: networkName,
        metagraphName: metagraphName,
      },
      entity: 'Metagraph',
      priority: 'P3',
    };
  };

  private buildFailedRestartAlertBody = (failedReason: string): object => {
    const { name: metagraphName, nodes: metagraphNodes, id } = config.metagraph;
    const { name: networkName } = config.network;

    const nodesInformation = metagraphNodes
      .map((node, idx) => {
        const nodeInfo = `
      Node ${idx + 1} - IP: ${node.ip}
      Metagraph L0 - http://${node.ip}:${config.metagraph.layers.ml0.ports.public}/node/info
      ${'cl1' in config.metagraph.layers ? `Currency L1 - http://${node.ip}:${config.metagraph.layers.cl1.ports.public}/node/info` : ''}
      ${'dl1' in config.metagraph.layers ? `Data L1 - http://${node.ip}:${config.metagraph.layers.dl1.ports.public}/node/info` : ''}
      `.trim();
        return nodeInfo;
      })
      .join('\n\n');

    return {
      message: `${metagraphName} Metagraph Failed to Restart`,
      description: `
      The ${metagraphName} Metagraph failed to restart on ${networkName}.
      Error message returned: ${failedReason}
      
      You can check the metagraph nodes on these URLs:
      ${nodesInformation}
      `,
      actions: ['Metagraph', 'Restart'],
      alias: `${id}_failure_restarted`,
      tags: [this.valid_network_tags_opsgenie[networkName as NetworkNames]],
      details: {
        metagraphId: id,
        network: networkName,
        metagraphName: metagraphName,
      },
      entity: 'Metagraph',
      priority: 'P1',
    };
  };

  private async createRemoteAlert(body: object) {
    try {
      await axios.post(this.opsgenie_alert_url, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `GenieKey ${await this.getOpsgenieApiKey()}`,
        },
      });
    } catch (e) {
      throw new Error(`Failing when creating remote alert: ${e}`);
    }
  }

  async createRestartStarted(
    restartType: string,
    restartReason: string,
  ): Promise<void> {
    this.customLog(`Creating remote alert MetagraphRestartStarted`);
    const alertBody = this.buildStartedRestartAlertBody(
      restartType,
      restartReason,
    );

    await this.createRemoteAlert(alertBody);
    this.customLog(`Alert created`);
  }

  async createRestartFailed(failedReason: string): Promise<void> {
    this.customLog(`Creating remote alert MetagraphRestartFailed`);
    const alertBody = this.buildFailedRestartAlertBody(failedReason);

    await this.createRemoteAlert(alertBody);
    this.customLog(`Alert created`);
  }

  async closeAlert(alertType: AlertType): Promise<void> {
    this.customLog(`Closing ${alertType} alert`);
    const body = {
      user: 'Monitoring Script',
      source: 'Node',
      note: 'Action executed via Alert API',
    };

    let alias = '';
    if (alertType === 'RestartStarted') {
      alias = `${config.metagraph.id}_restart`;
    } else {
      alias = `${config.metagraph.id}_failure_restarted`;
    }

    try {
      await axios.get(
        `${this.opsgenie_alert_url}/${alias}?identifierType=alias`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GenieKey ${await this.getOpsgenieApiKey()}`,
          },
        },
      );
    } catch (e) {
      this.logger.warn(`Alert ${alias} does not exists, skipping`);
      return;
    }

    try {
      await axios.post(
        `${this.opsgenie_alert_url}/${alias}/close?identifierType=alias`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GenieKey ${await this.getOpsgenieApiKey()}`,
          },
        },
      );
    } catch (e) {
      throw Error(`Failing when closing remote alert: ${e}`);
    }
  }
}