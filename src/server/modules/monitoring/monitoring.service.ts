import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import MonitoringApp from '@core/index';
import IRestartCondition from '@core/interfaces/restart-conditions/IRestartCondition';
import { MonitoringBridge, MonitoringState } from '@core/MonitoringBridge';
import { MonitoringConfiguration } from '@core/MonitoringConfiguration';
import {
  MonitoringLoggerAdapter,
  StoredLogEntry,
} from '@core/MonitoringLoggerAdapter';
import OpsgenieAlertService from '@core/services/alert/OpsgenieAlertService';
import AWSInstanceRebootService from '@core/services/instance-reboot/AWSInstanceRebootService';
import FileLoggerService from '@core/services/logger/FileLoggerService';
import DiscordNotificationService from '@core/services/notification/DiscordNotificationService';

import { LogLevel } from '../../../shared/types';

type MetagraphInstance = {
  bridge: MonitoringBridge;
  logAdapters: MonitoringLoggerAdapter[];
  metagraphName: string;
  metagraphId: string;
};

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly metagraphs = new Map<string, MetagraphInstance>();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      await this.initializeAllMetagraphs();
      this.logger.log(
        `Monitoring service initialized with ${this.metagraphs.size} metagraph(s): ${this.getMetagraphNames().join(', ')}`,
      );
    } catch (e) {
      this.logger.error('Failed to initialize monitoring service', e);
    }
  }

  async onModuleDestroy() {
    for (const [name, instance] of this.metagraphs) {
      instance.bridge.stop();
      this.logger.log(`Stopped monitoring for ${name}`);
    }
  }

  private async initializeAllMetagraphs() {
    const configDir = path.resolve(process.cwd(), 'config');
    if (!fs.existsSync(configDir)) {
      this.logger.warn('No config/ directory found');
      return;
    }

    const files = fs
      .readdirSync(configDir)
      .filter((f) => f.endsWith('.config.json'));

    if (files.length === 0) {
      const fallback = path.join(configDir, 'config.json');
      if (fs.existsSync(fallback)) {
        await this.initializeBridge(fallback);
        return;
      }
      this.logger.warn('No config files found in config/ directory');
      return;
    }

    for (const file of files) {
      const filePath = path.join(configDir, file);
      try {
        await this.initializeBridge(filePath);
      } catch (e) {
        this.logger.error(`Failed to initialize metagraph from ${file}`, e);
      }
    }
  }

  private async initializeBridge(configPath: string) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    const metagraphName: string =
      config.metagraph?.name ?? path.basename(configPath, '.config.json');
    const metagraphId: string = config.metagraph?.id ?? metagraphName;

    const fileLogger = new FileLoggerService();
    const loggerAdapter = new MonitoringLoggerAdapter(fileLogger, 'app');

    const app = new MonitoringApp(config, false, false, {
      loggerService: loggerAdapter,
    });

    // Configure optional services from env
    const opsgenieKey = this.configService.get<string>('OPSGENIE_API_KEY');
    if (opsgenieKey) {
      app.configuration.alertService = new OpsgenieAlertService(
        app.configuration,
        opsgenieKey,
      );
    }

    const awsKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecret = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const awsRegion = this.configService.get<string>('AWS_REGION');

    if (awsKeyId && awsSecret && awsRegion) {
      const awsCreds = {
        accessKeyId: awsKeyId,
        secretAccessKey: awsSecret,
        region: awsRegion,
        sessionToken: this.configService.get<string>('AWS_SESSION_TOKEN'),
      };
      app.configuration.instanceRebootService = new AWSInstanceRebootService(
        app.configuration,
        awsCreds,
      );
    }

    const discordWebhook = this.configService.get<string>(
      'DISCORD_WEBHOOK_URL',
    );
    if (discordWebhook) {
      app.configuration.notificationService = new DiscordNotificationService(
        app.configuration,
        discordWebhook,
      );
    }

    // Load custom conditions from custom-conditions/ directory
    const customConditions = await this.loadCustomConditions(app.configuration);
    if (customConditions.length > 0) {
      const existing = app.configuration.getRestartConditions();
      app.configuration.setRestartConditions([
        ...existing,
        ...customConditions,
      ]);
      this.logger.log(
        `Loaded ${customConditions.length} custom condition(s) for ${metagraphName}`,
      );
    }

    const bridge = new MonitoringBridge(app, loggerAdapter);
    bridge.start();

    this.metagraphs.set(metagraphName, {
      bridge,
      logAdapters: [loggerAdapter],
      metagraphName,
      metagraphId,
    });
    this.logger.log(`Initialized monitoring for metagraph: ${metagraphName}`);
  }

  private async loadCustomConditions(
    monitoringConfiguration: MonitoringConfiguration,
  ): Promise<IRestartCondition[]> {
    const conditionsDir = path.resolve(process.cwd(), 'custom-conditions');
    if (!fs.existsSync(conditionsDir)) return [];

    const files = fs
      .readdirSync(conditionsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    const conditions: IRestartCondition[] = [];
    for (const file of files) {
      if (file === 'README.md' || file === '.gitkeep') continue;
      try {
        const filePath = path.join(conditionsDir, file);
        const mod = await import(filePath);
        const ConditionClass = mod.default ?? mod;
        if (typeof ConditionClass !== 'function') continue;
        const instance = new ConditionClass(monitoringConfiguration);
        if (
          typeof instance.shouldRestart === 'function' &&
          typeof instance.triggerRestart === 'function'
        ) {
          conditions.push(instance);
          this.logger.log(
            `Loaded custom condition: ${instance.name} from ${file}`,
          );
        }
      } catch (e) {
        this.logger.error(`Failed to load custom condition from ${file}`, e);
      }
    }
    return conditions;
  }

  private getInstance(metagraph: string): MetagraphInstance {
    const instance = this.metagraphs.get(metagraph);
    if (!instance) {
      throw new NotFoundException(`Metagraph '${metagraph}' not found`);
    }
    return instance;
  }

  getMetagraphNames(): string[] {
    return Array.from(this.metagraphs.keys());
  }

  getMetagraphsSummary(): {
    name: string;
    id: string;
    health: string;
    nodeCount: number;
    monitoringEnabled: boolean;
  }[] {
    return Array.from(this.metagraphs.values()).map((instance) => {
      const state = instance.bridge.getState();
      return {
        name: instance.metagraphName,
        id: instance.metagraphId,
        health: state.overallHealth,
        nodeCount: state.nodes.length,
        monitoringEnabled: state.loopRunning,
      };
    });
  }

  getState(metagraph: string): MonitoringState | null {
    return this.getInstance(metagraph).bridge.getState();
  }

  async forceCheck(metagraph: string): Promise<void> {
    await this.getInstance(metagraph).bridge.forceCheck();
  }

  async forceRestart(metagraph: string): Promise<void> {
    await this.getInstance(metagraph).bridge.forceRestart();
  }

  async restartNode(
    metagraph: string,
    nodeIndex: number,
    layers: string[],
  ): Promise<void> {
    const validLayers = layers.filter(
      (l) => l === 'ml0' || l === 'cl1' || l === 'dl1',
    ) as ('ml0' | 'cl1' | 'dl1')[];
    if (validLayers.length === 0) {
      throw new Error(
        'layers must contain "ml0", "cl1", "dl1", or a combination',
      );
    }
    await this.getInstance(metagraph).bridge.restartNode(
      nodeIndex,
      validLayers,
    );
  }

  getMonitoringEvents(metagraph: string): EventEmitter | null {
    return this.getInstance(metagraph).bridge.events ?? null;
  }

  getLogEvents(metagraph: string): EventEmitter[] {
    return this.getInstance(metagraph).logAdapters.map((a) => a.events);
  }

  queryLogs(
    metagraph: string,
    options: {
      level?: LogLevel;
      source?: string;
      from?: string;
      to?: string;
      nodeIp?: string;
      text?: string;
      offset?: number;
      limit?: number;
    },
  ): { entries: StoredLogEntry[]; total: number } {
    const instance = this.getInstance(metagraph);
    const adapters = options.source
      ? instance.logAdapters.filter((a) => a.source === options.source)
      : instance.logAdapters;

    const allEntries: StoredLogEntry[] = [];

    if (options.from || options.to) {
      for (const adapter of adapters) {
        const { entries } = adapter.queryFromFiles({
          ...options,
          offset: 0,
          limit: undefined,
        });
        allEntries.push(...entries);
      }

      const fileTimestamps = new Set(allEntries.map((e) => e.timestamp));
      for (const adapter of adapters) {
        const { entries } = adapter.query({
          ...options,
          offset: 0,
          limit: undefined,
        });
        for (const entry of entries) {
          if (!fileTimestamps.has(entry.timestamp)) {
            allEntries.push(entry);
          }
        }
      }
    } else {
      for (const adapter of adapters) {
        const { entries } = adapter.query({
          ...options,
          offset: 0,
          limit: undefined,
        });
        allEntries.push(...entries);
      }
    }

    allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const total = allEntries.length;
    const limit = options.limit ?? 500;
    const offset =
      options.offset != null ? options.offset : Math.max(0, total - limit);
    const entries = allEntries.slice(offset, offset + limit);

    return { entries, total };
  }

  toggleMonitoring(metagraph: string, enabled: boolean): { enabled: boolean } {
    const instance = this.getInstance(metagraph);
    if (enabled) {
      instance.bridge.start();
    } else {
      instance.bridge.stop();
    }
    return { enabled: instance.bridge.getState().loopRunning };
  }

  getConfig(metagraph: string) {
    return (
      this.getInstance(metagraph).bridge.getConfiguration()?.config ?? null
    );
  }
}
