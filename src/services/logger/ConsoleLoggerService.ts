import { createLogger, format, transports } from 'winston';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

export default class ConsoleLoggerService implements ILoggerService {
  private loggerService;

  constructor() {
    this.loggerService = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(
              (info) => `${info.timestamp} ${info.level}: ${info.message}`,
            ),
          ),
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
