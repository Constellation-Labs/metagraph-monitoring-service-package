/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';

import { Client } from 'ssh2';

import 'module-alias';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';

export default class Ssh2Service implements ISshService {
  connection: Client;
  nodeNumber: number;
  metagraphNode: MetagraphNode;
  loggerService: ILoggerService;
  private ip: string;
  private username: string;
  private password?: string;
  private privateKey: Buffer;
  private privateKeyPassword?: string;
  private defaultPath?: string;
  private isConnected: boolean;

  constructor(
    nodeNumber: number,
    metagraphNode: MetagraphNode,
    loggerService: ILoggerService,
    defaultPath?: string,
  ) {
    this.nodeNumber = nodeNumber;
    this.ip = metagraphNode.ip;
    this.username = metagraphNode.username;
    this.password = metagraphNode.password;
    this.loggerService = loggerService;
    const myFilePath = path.join(process.cwd(), metagraphNode.privateKeyPath);
    try {
      this.privateKey = fs.readFileSync(myFilePath);
    } catch (error) {
      throw new Error(
        `Failed to read private key from ${myFilePath}: ${error}`,
      );
    }
    this.privateKeyPassword = metagraphNode.privateKeyPassword;
    this.defaultPath = defaultPath;
    this.metagraphNode = metagraphNode;
    this.connection = new Client();
    this.isConnected = false;
  }

  private async customLogger(
    message: string,
    level: 'info' | 'error',
  ): Promise<void> {
    if (level === 'error') {
      await this.loggerService.error(`[Ssh2Service] ${message}`);
    } else {
      await this.loggerService.info(`[Ssh2Service] ${message}`);
    }
  }

  public async setConnection(): Promise<void> {
    if (this.isConnected) {
      await this.customLogger(
        `[Node ${this.nodeNumber}] Already connected`,
        'info',
      );
      return;
    }

    this.connection = new Client();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Connection to node ${this.nodeNumber} (${this.ip}) timed out after 300000ms`,
          ),
        );
      }, 60000); // 1-minute timeout for connection

      this.connection
        .on('ready', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.customLogger(
            `[Node ${this.nodeNumber}] Connected successfully`,
            'info',
          );
          resolve();
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          this.customLogger(
            `[Node ${this.nodeNumber}] Error when connecting: ${err.message}`,
            'error',
          );
          reject(err);
        })
        .connect({
          host: this.ip,
          port: 22,
          username: this.username,
          password: this.password || '',
          privateKey: this.privateKey,
          passphrase: this.privateKeyPassword || '',
        });
    });
  }

  public async executeCommand(
    command: string,
    ignoreErrors: boolean = true,
    timeoutMs: number = 300000, // 5 minutes default timeout
  ): Promise<string> {
    if (!this.isConnected) {
      throw new Error(
        `[Node ${this.nodeNumber}] Not connected. Call setConnection first.`,
      );
    }

    const commandParsed = this.defaultPath
      ? `cd ${this.defaultPath} && sudo ${command}`
      : `sudo ${command}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (stream) {
          stream.close();
        }
        reject(
          new Error(`Command timed out after ${timeoutMs}ms: ${commandParsed}`),
        );
      }, timeoutMs);

      let stream: any;

      this.connection.exec(commandParsed, (err, execStream) => {
        if (err) {
          clearTimeout(timeout);
          this.customLogger(
            `[Node ${this.nodeNumber}] Error when running command ${commandParsed}: ${err.message}`,
            'error',
          );
          return reject(err);
        }

        stream = execStream;

        let data = '';
        let errorData = '';

        stream
          .on('close', (code: number) => {
            clearTimeout(timeout);
            if (code !== 0 && !ignoreErrors) {
              this.customLogger(
                `[Node ${this.nodeNumber}] Command failed with code ${code}. Error: ${errorData}`,
                'error',
              );
              return reject(
                new Error(`Command failed with code ${code}: ${errorData}`),
              );
            }
            resolve(data);
          })
          .on('data', (chunk: Buffer) => {
            data += chunk.toString();
          })
          .stderr.on('data', (chunk: Buffer) => {
            errorData += chunk.toString();
          })
          .on('error', (err: Error) => {
            clearTimeout(timeout);
            this.customLogger(
              `[Node ${this.nodeNumber}] Stream error for command ${commandParsed}: ${err.message}`,
              'error',
            );
            reject(err);
          });
      });
    });
  }

  public async destroyConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.customLogger(
        `[Node ${this.nodeNumber}] No active connection to destroy`,
        'info',
      );
      return;
    }
    this.connection.end();
    this.connection.destroy();
    this.isConnected = false;
    await this.customLogger(
      `[Node ${this.nodeNumber}] Connection destroyed`,
      'info',
    );
  }
}
