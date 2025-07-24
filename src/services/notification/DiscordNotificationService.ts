import axios from 'axios';

import { INotificationService } from '@interfaces/index';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MonitoringConfiguration, Config } from 'src/MonitoringConfiguration';

export default class DiscordNotificationService
  implements INotificationService
{
  loggerService: ILoggerService;
  config: Config;

  private discordWebhookUrl: string;
  private discordRoleId?: string;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    discordWebhookUrl: string,
    discordRoleId?: string,
  ) {
    this.config = monitoringConfiguration.config;
    this.loggerService = monitoringConfiguration.loggerService;
    this.discordWebhookUrl = discordWebhookUrl;
    this.discordRoleId = discordRoleId;
  }

  private customLog(message: string) {
    this.loggerService.info(`[DiscordNotificationService] ${message}`);
  }

  private sendDiscordMessage = async (message: string) => {
    try {
      await axios.post(this.discordWebhookUrl, {
        content: message,
      });
      this.customLog('📩 Sent message to Discord.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.customLog(`❌ Failed to send Discord message: ${error.message}`);
    }
  };

  async notifyUsers(message: string): Promise<void> {
    await this.sendDiscordMessage(message);
  }
}
