import fs from 'fs';
import path from 'path';

import { Client } from 'ssh2';

import 'module-alias';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';

export default class Ssh2Service implements ISshService {
  private ip: string;
  private username: string;
  private privateKey: Buffer;
  private defaultPath?: string;

  nodeNumber: number;
  connection: Client;
  metagraphNode: MetagraphNode;
  logger: ILoggerService;

  constructor(
    nodeNumber: number,
    metagraphNode: MetagraphNode,
    logger: ILoggerService,
    defaultPath?: string,
  ) {
    this.nodeNumber = nodeNumber;
    this.ip = metagraphNode.ip;
    this.username = metagraphNode.username;
    this.logger = logger;
    const myFilePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      metagraphNode.privateKeyPath,
    );

    this.privateKey = fs.readFileSync(myFilePath);
    this.defaultPath = defaultPath;
    this.metagraphNode = metagraphNode;
    this.connection = new Client();
  }

  private async customLogger(message: string, level: 'info' | 'error') {
    if (level === 'error') {
      this.logger.error(`[Ssh2Service] ${message}`);
    } else {
      this.logger.info(`[Ssh2Service] ${message}`);
    }
  }

  public async setConnection() {
    await new Promise((resolve, reject) => {
      this.connection
        .connect({
          host: this.ip,
          port: 22,
          username: this.username,
          privateKey: this.privateKey,
        })
        .on('ready', () => {
          this.customLogger(
            `[Node ${this.nodeNumber}] Connected successfully`,
            'info',
          );
          resolve(this.connection);
        })
        .on('error', (err) => {
          this.customLogger(
            `[Node ${this.nodeNumber}] Error when connecting`,
            'error',
          );
          reject(err);
        });
    });
  }

  public async executeCommand(command: string): Promise<string> {
    const conn = await this.connection;
    const commandParsed = this.defaultPath
      ? `cd ${this.defaultPath}
      sudo ${command}
      `
      : `sudo ${command}`;

    return new Promise((resolve, reject) => {
      conn.exec(commandParsed, (err, stream) => {
        if (err) {
          this.customLogger(
            `[Node ${this.nodeNumber}] Error when running command ${commandParsed}. Error: ${err}`,
            'error',
          );
          reject(err);
          return;
        }
        let data = '';
        stream
          .on('close', () => {
            if (!data) {
              resolve(data);
              return;
            }
            resolve(data);
          })
          .on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
      });
    });
  }

  public async destroyConnection() {
    (await this.connection).destroy();
  }
}
