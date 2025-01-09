import axios from 'axios';

import IAlertCondition, {
  ShouldAlertInfo,
} from '@interfaces/alert-conditions/IAlertCondition';
import { IMetagraphService } from '@interfaces/index';
import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

export default class OwnerWalletOutOfFunds implements IAlertCondition {
  name = 'OwnerWalletOutOfFunds';
  config: Config;
  sshServices: ISshService[];
  loggerService: ILoggerService;
  alertService: IAlertService;
  metagraphService: IMetagraphService;
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  beUrl: string;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    const { name } = monitoringConfiguration.config.network;
    this.beUrl = `https://be-${name}.constellationnetwork.io`;
    this.sshServices = monitoringConfiguration.sshServices;
    this.loggerService = monitoringConfiguration.loggerService;
    this.alertService = monitoringConfiguration.alertService;
    this.metagraphService = monitoringConfiguration.metagraphService;
    this.alertPriority = 'P3';
  }

  private customLogger(
    message: string,
    level: 'Info' | 'Warn' | 'Error' = 'Info',
  ) {
    const logMethods: Record<'Info' | 'Warn' | 'Error', (msg: string) => void> =
      {
        Info: this.loggerService.info.bind(this.loggerService),
        Warn: this.loggerService.warn.bind(this.loggerService),
        Error: this.loggerService.error.bind(this.loggerService),
      };

    logMethods[level](`[OwnerWalletOutOfFunds] ${message}`);
  }

  async shouldAlert(): Promise<ShouldAlertInfo> {
    const minOwnerWalletBalance = this.config.min_owner_wallet_balance;
    if (!minOwnerWalletBalance) {
      this.customLogger(
        `Minimal owner wallet balance not filled in config, ignoring`,
      );
      return {
        shouldAlert: false,
      };
    }
    try {
      const { ownerAddress } = this.metagraphService.metagraphSnapshotInfo;
      const ownerAddressBalanceApiResponse = await axios.get(
        `${this.beUrl}/addresses/${ownerAddress}/balance`,
      );

      const ownerWalletBalance =
        ownerAddressBalanceApiResponse.data.data.balance / 10e7;

      if (ownerWalletBalance > minOwnerWalletBalance) {
        this.customLogger('Owner wallet with enough balance');

        await this.alertService.closeAlert('Informative', this.name);

        return {
          shouldAlert: false,
        };
      }

      const message = `Metagraph ${this.config.metagraph.name} owner address with low balance: ${ownerWalletBalance}`;

      this.customLogger(message, 'Warn');

      return {
        shouldAlert: true,
        message,
        alertName: this.name,
      };
    } catch (e) {
      this.customLogger(
        `Error when checking owner wallet out of funds: ${e}`,
        'Error',
      );
      return {
        shouldAlert: false,
      };
    }
  }

  async triggerAlert(message: string): Promise<void> {
    await this.alertService.createInformativeAlert(
      message,
      this.name,
      this.alertPriority,
    );
  }
}
