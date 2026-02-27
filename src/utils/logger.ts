import ILoggerService from '@interfaces/services/logger/ILoggerService';

export class Logger {
  constructor(
    private loggerService: ILoggerService,
    private context: string,
  ) {}

  info(message: string) {
    this.loggerService.info(`[${this.context}] ${message}`);
  }

  warn(message: string) {
    this.loggerService.warn(`[${this.context}] ${message}`);
  }

  error(message: string) {
    this.loggerService.error(`[${this.context}] ${message}`);
  }
}
