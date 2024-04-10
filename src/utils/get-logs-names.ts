import { utc } from 'moment';

export type LogsNames = {
  ml0LogName: string;
  cl1LogName: string;
  dl1LogName: string;
};

export default (): LogsNames => {
  const now = utc().format('YYY-MM-DD_HH-mm-ss');

  const ml0LogName = `log-${now}-ml0`;
  const cl1LogName = `log-${now}-cl1`;
  const dl1LogName = `log-${now}-dl1`;

  return {
    ml0LogName,
    cl1LogName,
    dl1LogName,
  };
};
