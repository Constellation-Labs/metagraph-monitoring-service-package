import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { getLogName } from '@utils/get-logs-names';

dayjs.extend(utc);

const layerDirMap: Record<AvailableLayers, string> = {
  [Layers.ML0]: 'metagraph-l0',
  [Layers.CL1]: 'currency-l1',
  [Layers.DL1]: 'data-l1',
};

export const DEFAULT_RESTART_LOGS_RETENTION_DAYS = 30;

// Each restart moves a layer's logs/ folder into restart_logs/ (1 to 3 GB on
// mainnet). Without cleanup the copies fill the disk, so after the move this
// gzips the copy's plain .log files and deletes copies whose folder-name date
// is older than the retention window. Both run detached at low priority so a
// large backlog does not hold up the restart. A retention of 0 keeps
// everything (the old behavior).
export const buildCleanupCommand = (
  logName: string,
  retentionDays: number,
  now: dayjs.Dayjs = dayjs.utc(),
): string => {
  if (retentionDays <= 0) {
    return '';
  }
  const cutoff = `log-${now.subtract(retentionDays, 'day').format('YYYY-MM-DD')}`;
  const script = [
    `find restart_logs/${logName} -type f -name '*.log' -size +0 -exec gzip -q {} +`,
    `ls restart_logs | awk -v c=${cutoff} '/^log-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]_/ && $0 < c' | while read -r d; do rm -rf "restart_logs/$d"; done`,
  ].join('; ');
  return `(nohup nice -n 19 sh -c "${script.replace(/(["$`\\])/g, '\\$1')}" >/dev/null 2>&1 &)`;
};

export default async (
  sshService: ISshService,
  layer: AvailableLayers,
  retentionDays: number = DEFAULT_RESTART_LOGS_RETENTION_DAYS,
): Promise<void> => {
  const logName = getLogName(layer);
  const dir = layerDirMap[layer];

  await sshService.executeCommand(
    `
    mkdir -p restart_logs
    if [ -e "${dir}/logs" ]; then
      mv ${dir}/logs restart_logs/${logName}
      ${buildCleanupCommand(logName, retentionDays)}
    else
      echo "Logs does not exist, skipping move."
    fi
  `,
  );
};
