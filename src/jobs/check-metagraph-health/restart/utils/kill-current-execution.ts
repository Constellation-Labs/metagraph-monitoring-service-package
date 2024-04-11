import ISshService from '@interfaces/services/ssh/ISshService';

export default async (sshService: ISshService, port: number): Promise<void> => {
  await sshService.executeCommand(`fuser -k ${port}/tcp`);
};
