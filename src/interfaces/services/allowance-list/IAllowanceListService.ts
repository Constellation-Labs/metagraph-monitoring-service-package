import { AvailableLayers } from '@shared/constants';

import ILoggerService from '../logger/ILoggerService';

export type AllowanceListInfo = {
  fileName: string;
  url: string;
};

export default interface IAllowanceListService {
  loggerService: ILoggerService;
  buildAllowanceListformation(
    layer: AvailableLayers,
  ): Promise<AllowanceListInfo>;
}
