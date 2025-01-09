import IAlertCondition, {
  ShouldAlertInfo,
} from '@interfaces/alert-conditions/IAlertCondition';
import IAlertService from '@interfaces/services/alert/IAlertService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import ISshService from '@interfaces/services/ssh/ISshService';
import { Config, MonitoringConfiguration } from 'src/MonitoringConfiguration';

export default class freeDiskSpacePercentLimit implements IAlertCondition {
  name = 'freeDiskSpacePercentLimit';
  config: Config;
  sshServices: ISshService[];
  loggerService: ILoggerService;
  alertService: IAlertService;
  alertPriority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.config = monitoringConfiguration.config;
    this.sshServices = monitoringConfiguration.sshServices;
    this.loggerService = monitoringConfiguration.loggerService;
    this.alertService = monitoringConfiguration.alertService;
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

    logMethods[level](`[freeDiskSpacePercentLimit] ${message}`);
  }

  async shouldAlert(): Promise<ShouldAlertInfo> {
    const minfreeDiskSpacePercentPercent = this.config.min_disk_space_percent;
    if (!minfreeDiskSpacePercentPercent) {
      this.customLogger(
        `Minimal disk space percent not filled in config, ignoring`,
      );
      return {
        shouldAlert: false,
      };
    }
    try {
      const instanceInformation = await Promise.all(
        this.sshServices.map(async (sshService) => {
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
        this.customLogger('All instances with enough disk space');

        await this.alertService.closeAlert('Informative', this.name);

        return {
          shouldAlert: false,
        };
      }

      const message = instancesWithLowfreeDiskSpacePercent
        .map(
          (instance) =>
            `IP: ${instance.ip}, Current Disk Space Percent: ${instance.freeDiskSpacePercent}%`,
        )
        .join('\n');

      this.customLogger(
        `Condition freeDiskSpacePercentLimit detected, message: ${message}`,
      );

      return {
        shouldAlert: true,
        message,
        alertName: this.name,
      };
    } catch (e) {
      this.customLogger(`Error when checking node disk space: ${e}`, 'Error');
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
