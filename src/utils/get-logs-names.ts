import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { AvailableLayers } from '@shared/constants';

dayjs.extend(utc);

export type LogsNames = {
  ml0LogName: string;
  cl1LogName: string;
  dl1LogName: string;
};

export function getLogName(layer: AvailableLayers): string {
  const now = dayjs.utc().format('YYYY-MM-DD_HH-mm-ss');
  return `log-${now}-${layer}`;
}

export default (): LogsNames => {
  const now = dayjs.utc().format('YYYY-MM-DD_HH-mm-ss');

  const ml0LogName = `log-${now}-ml0`;
  const cl1LogName = `log-${now}-cl1`;
  const dl1LogName = `log-${now}-dl1`;

  return {
    ml0LogName,
    cl1LogName,
    dl1LogName,
  };
};
