import { createLogger, format, transports } from 'winston';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

export class FileLoggerService implements ILoggerService {
  private logger;

  constructor() {
    this.logger = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new transports.File({ filename: 'logs/combined.log' }),
        new transports.File({
          filename: 'logs/errors.log',
          level: 'error',
        }),
      ],
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
