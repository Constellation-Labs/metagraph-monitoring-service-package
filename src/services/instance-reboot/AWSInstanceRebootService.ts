import {
  EC2Client,
  RebootInstancesCommand,
  DescribeInstancesCommand,
  EC2ClientConfig,
} from '@aws-sdk/client-ec2';

import { IInstanceRebootService } from '@interfaces/index';
import IGlobalNetworkService from '@interfaces/services/global-network/IGlobalNetworkService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  sessionToken?: string;
}

/**
 * To use this service, be sure to authorize your user to perform a reboot on instances through IAM
 {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "ec2:RebootInstances",
            "Resource": "*"
        }
    ]
}
 */
export default class AWSInstanceRebootService
  implements IInstanceRebootService
{
  name = 'AWS Instance Reboot';
  config: Config;
  sshServices: ISshService[];
  globalNetworkService: IGlobalNetworkService;
  loggerService: ILoggerService;
  private logger: Logger;
  lookbackOffset = 50;

  private ec2Client: EC2Client;

  constructor(
    monitoringConfiguration: MonitoringConfiguration,
    awsCredentials: AWSCredentials,
  ) {
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.globalNetworkService = monitoringConfiguration.globalNetworkService;
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'AWSInstanceReboot');

    const ec2Config: EC2ClientConfig = {
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
      },
      region: awsCredentials.region || 'us-east-1',
    };

    this.ec2Client = new EC2Client(ec2Config);
  }

  private async getInstanceState(
    instanceId: string,
  ): Promise<string | undefined> {
    try {
      const command = new DescribeInstancesCommand({
        InstanceIds: [instanceId],
      });

      const response = await this.ec2Client.send(command);

      if (response.Reservations && response.Reservations.length > 0) {
        const instance = response.Reservations[0].Instances?.[0];
        return instance?.State?.Name;
      }

      return undefined;
    } catch (error) {
      this.logger.error(
        `Failed to get instance state for ${instanceId}: ${error}`,
      );
      throw error;
    }
  }

  async rebootInstance(instanceId: string): Promise<void> {
    try {
      this.logger.info(`Checking current state of instance: ${instanceId}`);

      const currentState = await this.getInstanceState(instanceId);

      if (!currentState) {
        throw new Error(`Could not determine state of instance ${instanceId}`);
      }

      this.logger.info(`Instance ${instanceId} current state: ${currentState}`);

      // Check if instance is already rebooting or in a transitional state
      if (currentState === 'rebooting') {
        this.logger.info(
          `Instance ${instanceId} is already rebooting. Skipping reboot request.`,
        );
        return;
      }

      // Check if instance is in a state where reboot is not appropriate
      if (
        [
          'pending',
          'shutting-down',
          'terminated',
          'stopping',
          'stopped',
        ].includes(currentState)
      ) {
        this.logger.info(
          `Instance ${instanceId} is in state '${currentState}'. Cannot reboot at this time.`,
        );
        throw new Error(
          `Instance ${instanceId} is in '${currentState}' state and cannot be rebooted`,
        );
      }

      // Proceed with reboot if instance is in 'running' state
      if (currentState === 'running') {
        this.logger.info(`Attempting to reboot instance: ${instanceId}`);

        const command = new RebootInstancesCommand({
          InstanceIds: [instanceId],
        });

        await this.ec2Client.send(command);

        this.logger.info(
          `Successfully initiated reboot for instance: ${instanceId}`,
        );
      } else {
        this.logger.info(
          `Instance ${instanceId} is in unexpected state '${currentState}'. Reboot may not behave as expected.`,
        );
        throw new Error(
          `Instance ${instanceId} is in unexpected state: ${currentState}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to reboot instance ${instanceId}: ${error}`);
      throw error;
    }
  }
}
