import ISshService from '@interfaces/services/ISshService';

export default async (sshService: ISshService, port: number): Promise<void> => {
  console.log(`Stopping current process on port: ${port}`);
  await sshService.executeCommand(`fuser -k ${port}/tcp`);
};