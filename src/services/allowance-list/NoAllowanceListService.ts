import { IAllowanceListService } from '@interfaces/index';
import { AllowanceListInfo } from '@interfaces/services/allowance-list/IAllowanceListService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

export default class NoAllowanceListService implements IAllowanceListService {
  loggerService: ILoggerService;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
  }

  private async customLogger(message: string) {
    this.loggerService.info(`[NoAllowanceListService] ${message}`);
  }

  async buildAllowanceListformation(
    layer: AvailableLayers,
  ): Promise<AllowanceListInfo> {
    this.customLogger(`No allowance list for layer ${layer}`);
    return {
      url: '',
      fileName: '',
    };
  }
}
