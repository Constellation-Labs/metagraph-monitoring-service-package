import { createLogger, format, transports } from 'winston';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

export class ConsoleLoggerService implements ILoggerService {
  private logger;

  constructor() {
    this.logger = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [new transports.Console()],
    });
  }

  info(message: string, meta?: unknown): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.logger.warn(message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.logger.error(message, meta);
  }
}
