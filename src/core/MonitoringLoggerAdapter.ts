import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import ILoggerService from '@interfaces/services/logger/ILoggerService';

import { LogEntryEvent } from '../shared/events/monitoring-event';
import { LogLevel } from '../shared/types';

export type StoredLogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  source: string;
};

const LEVEL_MAP: Record<string, LogLevel> = {
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

export class MonitoringLoggerAdapter implements ILoggerService {
  private ringBuffer: StoredLogEntry[] = [];
  private maxBufferSize: number;
  private delegate: ILoggerService;
  public readonly source: string;
  public readonly events: EventEmitter;
  private readonly logsDir: string;

  constructor(
    delegate: ILoggerService,
    source = 'app',
    maxBufferSize = 50_000,
  ) {
    this.delegate = delegate;
    this.source = source;
    this.maxBufferSize = maxBufferSize;
    this.logsDir = path.resolve(process.cwd(), 'logs');
    this.events = new EventEmitter();
    this.events.setMaxListeners(50);
  }

  private pushEntry(level: LogLevel, message: string): void {
    const entry: StoredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      source: this.source,
    };

    this.ringBuffer.push(entry);
    if (this.ringBuffer.length > this.maxBufferSize) {
      this.ringBuffer.shift();
    }

    const event: LogEntryEvent = {
      type: 'LogEntry',
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      source: this.source,
    };
    this.events.emit('log', event);
  }

  info(message: string, meta?: unknown): void {
    this.delegate.info(message, meta);
    this.pushEntry(LogLevel.INFO, message);
  }

  warn(message: string, meta?: unknown): void {
    this.delegate.warn(message, meta);
    this.pushEntry(LogLevel.WARN, message);
  }

  error(message: string, meta?: unknown): void {
    this.delegate.error(message, meta);
    this.pushEntry(LogLevel.ERROR, message);
  }

  getEntries(): StoredLogEntry[] {
    return [...this.ringBuffer];
  }

  query(options: {
    level?: LogLevel;
    from?: string;
    to?: string;
    nodeIp?: string;
    text?: string;
    offset?: number;
    limit?: number;
  }): { entries: StoredLogEntry[]; total: number } {
    let filtered = this.ringBuffer;

    if (options.level) {
      filtered = filtered.filter((e) => e.level === options.level);
    }
    if (options.from) {
      const fromTime = new Date(options.from).getTime();
      filtered = filtered.filter(
        (e) => new Date(e.timestamp).getTime() >= fromTime,
      );
    }
    if (options.to) {
      const toTime = new Date(options.to).getTime();
      filtered = filtered.filter(
        (e) => new Date(e.timestamp).getTime() <= toTime,
      );
    }
    if (options.nodeIp) {
      filtered = filtered.filter((e) => e.message.includes(options.nodeIp!));
    }
    if (options.text) {
      const search = options.text.toLowerCase();
      filtered = filtered.filter((e) =>
        e.message.toLowerCase().includes(search),
      );
    }

    const total = filtered.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? filtered.length;
    const entries = filtered.slice(offset, offset + limit);

    return { entries, total };
  }

  queryFromFiles(options: {
    level?: LogLevel;
    from?: string;
    to?: string;
    nodeIp?: string;
    text?: string;
    offset?: number;
    limit?: number;
  }): { entries: StoredLogEntry[]; total: number } {
    const fromDate = options.from ? new Date(options.from) : undefined;
    const toDate = options.to ? new Date(options.to) : undefined;

    const fileDates = this.getDateRange(fromDate, toDate);
    const allEntries: StoredLogEntry[] = [];

    for (const dateStr of fileDates) {
      const filePath = path.join(this.logsDir, `application-${dateStr}.log`);
      if (!fs.existsSync(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const level = LEVEL_MAP[parsed.level] ?? LogLevel.INFO;
            const entry: StoredLogEntry = {
              timestamp: parsed.ts ?? parsed.timestamp,
              level,
              message: parsed.msg ?? parsed.message ?? '',
              source: this.source,
            };

            if (options.level && entry.level !== options.level) continue;
            if (
              fromDate &&
              new Date(entry.timestamp).getTime() < fromDate.getTime()
            )
              continue;
            if (
              toDate &&
              new Date(entry.timestamp).getTime() > toDate.getTime()
            )
              continue;
            if (options.nodeIp && !entry.message.includes(options.nodeIp))
              continue;
            if (
              options.text &&
              !entry.message.toLowerCase().includes(options.text.toLowerCase())
            )
              continue;

            allEntries.push(entry);
          } catch {
            // Skip malformed lines
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    const total = allEntries.length;
    const offset = options.offset ?? 0;
    const limit = options.limit ?? allEntries.length;
    const entries = allEntries.slice(offset, offset + limit);

    return { entries, total };
  }

  private getDateRange(from?: Date, to?: Date): string[] {
    const dates: string[] = [];
    const start = from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = to ?? new Date();

    const maxDays = 30;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    for (let i = 0; i < maxDays; i++) {
      if (current > end) break;
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }
}
