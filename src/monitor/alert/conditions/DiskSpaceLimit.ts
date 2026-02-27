import IAlertCondition, {
  ShouldAlertInfo,
} from '@interfaces/alert-conditions/IAlertCondition';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../../utils/logger';

export default class freeDiskSpacePercentLimit implements IAlertCondition {
  private monitoringConfiguration: MonitoringConfiguration;
  private logger: Logger;

  name = 'freeDiskSpacePercentLimit';
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.monitoringConfiguration = monitoringConfiguration;
    this.logger = new Logger(
      monitoringConfiguration.loggerService,
      'DiskSpaceLimit',
    );
    this.alertPriority = 'P3';
  }

  async shouldAlert(): Promise<ShouldAlertInfo> {
    const minfreeDiskSpacePercentPercent =
      this.monitoringConfiguration.config.min_disk_space_percent;
    if (!minfreeDiskSpacePercentPercent) {
      this.logger.info(
        'Disk space check skipped (min_disk_space_percent not configured)',
      );
      return {
        shouldAlert: false,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    }
    try {
      const instanceInformation = await Promise.all(
        this.monitoringConfiguration.sshServices.map(async (sshService) => {
          const freeDiskSpacePercentResponse = await sshService.executeCommand(
            "df --output=used,size / | tail -n 1 | awk '{print 100 - ($1 / $2 * 100)}'",
          );
          const freeDiskSpacePercent = Number(freeDiskSpacePercentResponse);
          return {
            freeDiskSpacePercent,
            ip: sshService.metagraphNode.ip,
          };
        }),
      );

      const instancesWithLowfreeDiskSpacePercent = instanceInformation.filter(
        (info) => {
          return info.freeDiskSpacePercent <= minfreeDiskSpacePercentPercent;
        },
      );

      if (instancesWithLowfreeDiskSpacePercent.length === 0) {
        this.logger.info('All nodes have sufficient disk space');

        return {
          shouldAlert: false,
          alertName: this.name,
          alertPriority: this.alertPriority,
        };
      }

      const message = instancesWithLowfreeDiskSpacePercent
        .map(
          (instance) =>
            `IP: ${instance.ip}, Current Disk Space Percent: ${instance.freeDiskSpacePercent}%`,
        )
        .join('\n');

      this.logger.warn(`Low disk space detected: ${message}`);

      return {
        shouldAlert: true,
        message,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    } catch (e) {
      this.logger.error(`Failed to check disk space: ${e}`);
      return {
        shouldAlert: false,
        alertName: this.name,
        alertPriority: this.alertPriority,
      };
    }
  }
}
