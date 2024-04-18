import { createLogger, format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

export default class FileLoggerService implements ILoggerService {
  private loggerService;

  constructor() {
    this.loggerService = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
        }),

        new DailyRotateFile({
          filename: 'logs/errors-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
        }),
      ],
    });
  }

  info(message: string, meta?: unknown): void {
    this.loggerService.info(message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.loggerService.warn(message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.loggerService.error(message, meta);
  }
}
