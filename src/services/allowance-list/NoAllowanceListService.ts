import { IAllowanceListService } from '@interfaces/index';
import { AllowanceListInfo } from '@interfaces/services/allowance-list/IAllowanceListService';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { AvailableLayers } from '@shared/constants';
import { MonitoringConfiguration } from 'src/MonitoringConfiguration';

import { Logger } from '../../utils/logger';

export default class NoAllowanceListService implements IAllowanceListService {
  loggerService: ILoggerService;
  private logger: Logger;

  constructor(monitoringConfiguration: MonitoringConfiguration) {
    this.loggerService = monitoringConfiguration.loggerService;
    this.logger = new Logger(this.loggerService, 'NoAllowanceList');
  }

  async buildAllowanceListformation(
    layer: AvailableLayers,
  ): Promise<AllowanceListInfo> {
    this.logger.info(`No allowance list for layer ${layer}`);
    return {
      url: '',
      fileName: '',
    };
  }
}
