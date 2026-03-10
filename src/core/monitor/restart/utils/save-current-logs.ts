import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers, Layers } from '@shared/constants';
import { getLogName } from '@utils/get-logs-names';

const layerDirMap: Record<AvailableLayers, string> = {
  [Layers.ML0]: 'metagraph-l0',
  [Layers.CL1]: 'currency-l1',
  [Layers.DL1]: 'data-l1',
};

export default async (
  sshService: ISshService,
  layer: AvailableLayers,
): Promise<void> => {
  const logName = getLogName(layer);
  const dir = layerDirMap[layer];

  await sshService.executeCommand(
    `
    mkdir -p restart_logs
    if [ -e "${dir}/logs" ]; then
      mv ${dir}/logs restart_logs/${logName}
    else
      echo "Logs does not exist, skipping move."
    fi
  `,
  );
};
