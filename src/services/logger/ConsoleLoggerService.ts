import { createLogger, format, transports } from 'winston';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

const levelIcons: Record<string, string> = {
  info: '\x1b[36m\u25CF\x1b[0m', // cyan dot
  warn: '\x1b[33m\u25B2\x1b[0m', // yellow triangle
  error: '\x1b[31m\u2718\x1b[0m', // red X
};

const levelColors: Record<string, string> = {
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const reset = '\x1b[0m';
const dim = '\x1b[2m';

export default class ConsoleLoggerService implements ILoggerService {
  private loggerService;

  constructor() {
    this.loggerService = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new transports.Console({
          format: format.combine(
            format.printf((info) => {
              const ts = dim + info.timestamp + reset;
              const icon = levelIcons[info.level] || '';
              const lvl =
                (levelColors[info.level] || '') +
                info.level.toUpperCase().padEnd(5) +
                reset;
              return `${ts} ${icon} ${lvl} ${info.message}`;
            }),
          ),
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
