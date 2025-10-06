import ISshService from '@interfaces/services/ssh/ISshService';
import { AvailableLayers } from '@shared/constants';

const layerToJarMap: Record<AvailableLayers, string> = {
  ml0: 'metagraph-l0.jar',
  cl1: 'currency-l1.jar',
  dl1: 'data-l1.jar',
};

export async function killJavaJarByLayer(
  sshService: ISshService,
  layer: AvailableLayers,
  node: string,
): Promise<void> {
  const jarName = layerToJarMap[layer];

  const psCommand = `ps aux | grep -i '[j]ava.*${jarName}' | awk '{print $2}'`;
  let pidOutput: string;
  try {
    pidOutput = await sshService.executeCommand(psCommand, true, 300000);
  } catch (error) {
    await sshService.loggerService.info(
      `[FullLayer] Failed to find processes for JAR ${jarName} (layer: ${layer}) on node ${node}: ${error}`,
    );
    return;
  }

  if (!pidOutput || pidOutput.trim() === '') {
    await sshService.loggerService.info(
      `[FullLayer] No processes found for JAR ${jarName} (layer: ${layer}) on node ${node}`,
    );
    return;
  }

  const pids = pidOutput
    .trim()
    .split('\n')
    .filter((pid) => pid.match(/^\d+$/));

  if (pids.length === 0) {
    await sshService.loggerService.info(
      `[FullLayer] No valid PIDs found for JAR ${jarName} (layer: ${layer}) on node ${node}`,
    );
    return;
  }

  const failedPids: string[] = [];

  for (const pid of pids) {
    // Try SIGTERM first
    await sshService.loggerService.info(
      `[FullLayer] Terminating process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}, node: ${node})`,
    );
    try {
      await sshService.executeCommand(`kill -15 ${pid}`, false, 300000);
    } catch (error) {
      await sshService.loggerService.info(
        `[FullLayer] Failed to send SIGTERM to process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}) on node ${node}: ${error}`,
      );
      failedPids.push(pid);
      continue;
    }

    const verifyPidCommand = `ps -p ${pid} > /dev/null && echo "running" || echo "terminated"`;
    let verifyPidOutput: string;
    try {
      verifyPidOutput = await sshService.executeCommand(verifyPidCommand, true);
    } catch (error) {
      await sshService.loggerService.info(
        `[FullLayer] Failed to verify termination of process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}) on node ${node}: ${error}`,
      );
      failedPids.push(pid);
      continue;
    }

    if (verifyPidOutput.trim() === 'running') {
      await sshService.loggerService.info(
        `[FullLayer] SIGTERM failed, retrying with SIGKILL for process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}, node: ${node})`,
      );
      try {
        await sshService.executeCommand(`kill -9 ${pid}`, false, 300000);
      } catch (error) {
        await sshService.loggerService.info(
          `[FullLayer] Failed to send SIGKILL to process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}) on node ${node}: ${error}`,
        );
        failedPids.push(pid);
        continue;
      }

      // Verify after SIGKILL
      try {
        verifyPidOutput = await sshService.executeCommand(
          verifyPidCommand,
          true,
        );
      } catch (error) {
        await sshService.loggerService.info(
          `[FullLayer] Failed to verify SIGKILL termination of process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}) on node ${node}: ${error}`,
        );
        failedPids.push(pid);
        continue;
      }

      if (verifyPidOutput.trim() === 'running') {
        await sshService.loggerService.info(
          `[FullLayer] Failed to terminate process (PID: ${pid}, JAR: ${jarName}, layer: ${layer}, node: ${node})`,
        );
        failedPids.push(pid);
      } else {
        await sshService.loggerService.info(
          `[FullLayer] Successfully terminated process with SIGKILL (PID: ${pid}, JAR: ${jarName}, layer: ${layer}, node: ${node})`,
        );
      }
    } else {
      await sshService.loggerService.info(
        `[FullLayer] Successfully terminated process with SIGTERM (PID: ${pid}, JAR: ${jarName}, layer: ${layer}, node: ${node})`,
      );
    }
  }

  if (failedPids.length > 0) {
    await sshService.loggerService.info(
      `[FullLayer] Failed to terminate processes for JAR ${jarName} (layer: ${layer}) on node ${node} with PIDs: ${failedPids.join(', ')}`,
    );
  } else {
    await sshService.loggerService.info(
      `[FullLayer] All processes for JAR ${jarName} (layer: ${layer}) on node ${node} terminated successfully`,
    );
  }
}
