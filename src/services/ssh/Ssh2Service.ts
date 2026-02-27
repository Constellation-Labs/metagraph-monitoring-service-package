/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';

import { Client } from 'ssh2';

import 'module-alias';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';

import { Logger } from '../../utils/logger';

export default class Ssh2Service implements ISshService {
  connection: Client;
  nodeNumber: number;
  metagraphNode: MetagraphNode;
  loggerService: ILoggerService;
  private logger: Logger;
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
    this.logger = new Logger(loggerService, 'SshService');
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

  public async setConnection(): Promise<void> {
    if (this.isConnected) {
      this.logger.info(`[Node ${this.nodeNumber}] Already connected`);
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
          this.logger.info(`[Node ${this.nodeNumber}] Connected successfully`);
          resolve();
        })
        .on('error', (err) => {
          clearTimeout(timeout);
          this.logger.error(
            `[Node ${this.nodeNumber}] Connection failed: ${err.message}`,
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
          this.logger.error(
            `[Node ${this.nodeNumber}] Command exec failed: ${err.message}`,
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
              this.logger.error(
                `[Node ${this.nodeNumber}] Command failed with code ${code}. Error: ${errorData}`,
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
            this.logger.error(
              `[Node ${this.nodeNumber}] Stream error for command ${commandParsed}: ${err.message}`,
            );
            reject(err);
          });
      });
    });
  }

  public async destroyConnection(): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn(
        `[Node ${this.nodeNumber}] No active connection to destroy`,
      );
      return;
    }
    this.connection.end();
    this.connection.destroy();
    this.isConnected = false;
    this.logger.info(`[Node ${this.nodeNumber}] Connection destroyed`);
  }
}
