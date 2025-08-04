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

    const ec2Config: EC2ClientConfig = {
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
      },
      region: awsCredentials.region || 'us-east-1',
    };

    this.ec2Client = new EC2Client(ec2Config);
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[AWS Instance Reboot] ${message}`);
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
      this.loggerService.error(
        `Failed to get instance state for ${instanceId}`,
        error,
      );
      throw error;
    }
  }

  async rebootInstance(instanceId: string): Promise<void> {
    try {
      await this.customLogger(
        `Checking current state of instance: ${instanceId}`,
      );

      const currentState = await this.getInstanceState(instanceId);

      if (!currentState) {
        throw new Error(`Could not determine state of instance ${instanceId}`);
      }

      await this.customLogger(
        `Instance ${instanceId} current state: ${currentState}`,
      );

      // Check if instance is already rebooting or in a transitional state
      if (currentState === 'rebooting') {
        await this.customLogger(
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
        await this.customLogger(
          `Instance ${instanceId} is in state '${currentState}'. Cannot reboot at this time.`,
        );
        throw new Error(
          `Instance ${instanceId} is in '${currentState}' state and cannot be rebooted`,
        );
      }

      // Proceed with reboot if instance is in 'running' state
      if (currentState === 'running') {
        await this.customLogger(`Attempting to reboot instance: ${instanceId}`);

        const command = new RebootInstancesCommand({
          InstanceIds: [instanceId],
        });

        await this.ec2Client.send(command);

        await this.customLogger(
          `Successfully initiated reboot for instance: ${instanceId}`,
        );
      } else {
        await this.customLogger(
          `Instance ${instanceId} is in unexpected state '${currentState}'. Reboot may not behave as expected.`,
        );
        throw new Error(
          `Instance ${instanceId} is in unexpected state: ${currentState}`,
        );
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to reboot instance ${instanceId}`,
        error,
      );
      throw error;
    }
  }
}
