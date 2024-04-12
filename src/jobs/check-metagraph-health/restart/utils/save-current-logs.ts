import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import getLogsNames from '@utils/get-logs-names';

export default async (
  sshService: ISshService,
  layer: AvailableLayers,
): Promise<void> => {
  const logsNames = getLogsNames();
  if (layer === Layers.ML0) {
    await sshService.executeCommand(
      `
      mkdir -p restart_logs
      if [ -e "metagraph-l0/logs" ]; then
        mv metagraph-l0/logs restart_logs/${logsNames.ml0LogName}
      else
        echo "Logs does not exist, skipping move."
      fi
    `,
    );
    return;
  }
  if (layer === Layers.CL1) {
    await sshService.executeCommand(
      `
      mkdir -p restart_logs
      if [ -e "currency-l1/logs" ]; then
        mv currency-l1/logs restart_logs/${logsNames.cl1LogName}
      else
        echo "Logs does not exist, skipping move."
      fi
    `,
    );
    return;
  }

  await sshService.executeCommand(
    `
    mkdir -p restart_logs
    if [ -e "data-l1/logs" ]; then
      mv data-l1/logs restart_logs/${logsNames.dl1LogName}
    else
      echo "Logs does not exist, skipping move."
    fi
  `,
  );
  return;
};
