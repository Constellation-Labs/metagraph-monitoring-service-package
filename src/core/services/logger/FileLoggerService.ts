import { createLogger, format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

export default class FileLoggerService implements ILoggerService {
  private loggerService;

  constructor() {
    const structuredFormat = format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.printf((info) => {
        return JSON.stringify({
          ts: info.timestamp,
          level: info.level,
          msg: info.message,
        });
      }),
    );

    this.loggerService = createLogger({
      format: structuredFormat,
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

  info(message: string): void {
    this.loggerService.info(message);
  }

  warn(message: string): void {
    this.loggerService.warn(message);
  }

  error(message: string): void {
    this.loggerService.error(message);
  }
}
