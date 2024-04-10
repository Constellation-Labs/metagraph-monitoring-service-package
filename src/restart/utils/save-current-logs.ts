import ISshService from '@interfaces/ISshService';
import { Layers } from '@shared/constants';
import { LogsNames } from '@utils/get-logs-names';

export default async (
  sshService: ISshService,
  layer: Layers,
  logName: LogsNames,
): Promise<void> => {
  if (layer === 'ml0') {
    console.log(`Saving current metagraph-l0 logs`);
    await sshService.executeCommand(
      `
      mkdir -p restart_logs
      if [ -e "metagraph-l0/logs" ]; then
        mv metagraph-l0/logs restart_logs/${logName.ml0LogName}
      else
        echo "Logs does not exist, skipping move."
      fi
    `,
    );
    return;
  }
  if (layer === 'cl1') {
    console.log(`Saving current currency-l1 logs`);
    await sshService.executeCommand(
      `
      mkdir -p restart_logs
      if [ -e "currency-l1/logs" ]; then
        mv currency-l1/logs restart_logs/${logName.cl1LogName}
      else
        echo "Logs does not exist, skipping move."
      fi
    `,
    );
    return;
  }

  console.log(`Saving current data-l1 logs`);
  await sshService.executeCommand(
    `
    mkdir -p restart_logs
    if [ -e "data-l1/logs" ]; then
      mv data-l1/logs restart_logs/${logName.dl1LogName}
    else
      echo "Logs does not exist, skipping move."
    fi
  `,
  );
  return;
};
