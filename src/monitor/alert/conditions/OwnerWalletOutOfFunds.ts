import axios from 'axios';

import IAlertCondition, {
  ShouldAlertInfo,
} from '@interfaces/alert-conditions/IAlertCondition';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';

export default class OwnerWalletOutOfFunds implements IAlertCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'OwnerWalletOutOfFunds';
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  beUrl: string;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'OwnerWalletOutOfFunds',
    );
    const { name } = monitoringConfiguration.config.network;
    this.beUrl = `https://be-${name}.constellationnetwork.io`;
    this.alertPriority = 'P3';
  }

  async shouldAlert(): Promise<ShouldAlertInfo> {
    const minOwnerWalletBalance =
      this.monitoringConfiguration.config.min_owner_wallet_balance;
    if (!minOwnerWalletBalance) {
      this.logger.info(
        'Wallet balance check skipped (min_owner_wallet_balance not configured)',
      );
      return {
        shouldAlert: false,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    }
    try {
      const { ownerAddress } =
        this.monitoringConfiguration.metagraphService.metagraphSnapshotInfo;
      const ownerAddressBalanceApiResponse = await axios.get(
        `${this.beUrl}/addresses/${ownerAddress}/balance`,
      );

      const ownerWalletBalance =
        ownerAddressBalanceApiResponse.data.data.balance / 10e7;

      if (ownerWalletBalance > minOwnerWalletBalance) {
        this.logger.info(
          `Owner wallet balance sufficient (${ownerWalletBalance})`,
        );

        return {
          shouldAlert: false,
          alertName: this.name,
          alertPriority: this.alertPriority,
        };
      }

      const message = `Metagraph ${this.monitoringConfiguration.config.metagraph.name} owner address with low balance: ${ownerWalletBalance}`;

      this.logger.warn(message);

      return {
        shouldAlert: true,
        message,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    } catch (e) {
      this.logger.error(`Failed to check owner wallet balance: ${e}`);
      return {
        shouldAlert: false,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    }
  }
}
