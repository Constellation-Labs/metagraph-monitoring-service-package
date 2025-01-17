import axios from 'axios';

import IAlertService, {
  AlertType,
} from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { NetworkNames } from '@shared/constants';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

export default class OpsgenieAlertService implements IAlertService {
  loggerService: ILoggerService;
  config: Config;

  private opsgenie_alert_url: string = 'https://api.opsgenie.com/v2/alerts';
  private opsgenie_api_key: string;

  private valid_network_tags_opsgenie = {
    mainnet: 'env:MainNet',
    integrationnet: 'env:IntegrationNet',
    testnet: 'env:TestNet',
  };

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    opsgenieAlertKey: string,
  ) {
    this.config = monitoringConfiguration.config;
    this.loggerService = monitoringConfiguration.loggerService;
    this.opsgenie_api_key = opsgenieAlertKey;
  }

  private customLog(message: string) {
    this.loggerService.info(`[OpsgenieAlertService] ${message}`);
  }

  private buildStartedRestartAlertBody = (
    restartType: string,
    restartReason: string,
    lastMetagraphSnapshotOrdinal?: number,
  ): object => {
    const {
      name: metagraphName,
      nodes: metagraphNodes,
      id,
    } = this.config.metagraph;
    const { name: networkName } = this.config.network;

    const nodesInformation = metagraphNodes
      .map((node, idx) => {
        const nodeInfo = `
      Node ${idx + 1} - IP: ${node.ip}
      ${lastMetagraphSnapshotOrdinal ? `Last metagraph snapshot in block explorer: ${lastMetagraphSnapshotOrdinal}` : ``}
      Metagraph L0 - http://${node.ip}:${this.config.metagraph.layers.ml0.ports.public}/node/info
      ${!this.config.metagraph.layers.cl1.ignore_layer ? `Currency L1 - http://${node.ip}:${this.config.metagraph.layers.cl1.ports.public}/node/info` : ''}
      ${!this.config.metagraph.layers.dl1.ignore_layer ? `Data L1 - http://${node.ip}:${this.config.metagraph.layers.dl1.ports.public}/node/info` : ''}
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
    const {
      name: metagraphName,
      nodes: metagraphNodes,
      id,
    } = this.config.metagraph;
    const { name: networkName } = this.config.network;

    const nodesInformation = metagraphNodes
      .map((node, idx) => {
        const nodeInfo = `
      Node ${idx + 1} - IP: ${node.ip}
      Metagraph L0 - http://${node.ip}:${this.config.metagraph.layers.ml0.ports.public}/node/info
      ${!this.config.metagraph.layers.cl1.ignore_layer ? `Currency L1 - http://${node.ip}:${this.config.metagraph.layers.cl1.ports.public}/node/info` : ''}
      ${!this.config.metagraph.layers.dl1.ignore_layer ? `Data L1 - http://${node.ip}:${this.config.metagraph.layers.dl1.ports.public}/node/info` : ''}
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

  private buildInformativeAlertBody = (
    message: string,
    alertName: string,
    alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
  ): object => {
    const { name: metagraphName, id } = this.config.metagraph;
    const { name: networkName } = this.config.network;

    return {
      message: `Informative Alert - ${metagraphName} ${alertName}`,
      description: `${message}`,
      actions: ['Metagraph', 'Informative'],
      alias: `${id}_informative_${alertName}`,
      tags: [this.valid_network_tags_opsgenie[networkName as NetworkNames]],
      details: {
        metagraphId: id,
        network: networkName,
        metagraphName: metagraphName,
      },
      entity: 'Metagraph',
      priority: alertPriority,
    };
  };

  private async createRemoteAlert(body: object) {
    try {
      await axios.post(this.opsgenie_alert_url, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `GenieKey ${await this.opsgenie_api_key}`,
        },
      });
    } catch (e) {
      throw new Error(`Failing when creating remote alert: ${e}`);
    }
  }

  async createRestartStarted(
    restartType: string,
    restartReason: string,
    lastMetagraphSnapshotOrdinal?: number,
  ): Promise<void> {
    this.customLog(`Creating remote alert MetagraphRestartStarted`);
    const alertBody = this.buildStartedRestartAlertBody(
      restartType,
      restartReason,
      lastMetagraphSnapshotOrdinal,
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

  async closeAlert(alertType: AlertType, alertName?: string): Promise<void> {
    this.customLog(`Closing ${alertType} alert`);
    const body = {
      user: 'Monitoring Script',
      source: 'Node',
      note: 'Action executed via Alert API',
    };

    let alias = '';
    if (alertType === 'RestartStarted') {
      alias = `${this.config.metagraph.id}_restart`;
    } else if (alertType === 'RestartFailed') {
      alias = `${this.config.metagraph.id}_failure_restarted`;
    } else {
      alias = `${this.config.metagraph.id}_informative_${alertName}`;
    }

    try {
      await axios.get(
        `${this.opsgenie_alert_url}/${alias}?identifierType=alias`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GenieKey ${await this.opsgenie_api_key}`,
          },
        },
      );
    } catch (e) {
      this.loggerService.warn(`Alert ${alias} does not exists, skipping`);
      return;
    }

    try {
      await axios.post(
        `${this.opsgenie_alert_url}/${alias}/close?identifierType=alias`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `GenieKey ${await this.opsgenie_api_key}`,
          },
        },
      );
    } catch (e) {
      throw Error(`Failing when closing remote alert: ${e}`);
    }
  }

  async createInformativeAlert(
    message: string,
    alertName: string,
    alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5',
  ): Promise<void> {
    this.customLog(`Creating remote informative alert: ${alertName}`);
    const alertBody = this.buildInformativeAlertBody(
      message,
      alertName,
      alertPriority,
    );

    await this.createRemoteAlert(alertBody);
    this.customLog(`Alert created`);
  }
}
