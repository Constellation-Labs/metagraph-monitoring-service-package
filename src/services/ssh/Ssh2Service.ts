import fs from 'fs';
import path from 'path';

import { Client } from 'ssh2';

import 'module-alias';
import ILoggerService from '@interfaces/services/logger/ILoggerService';
import { MetagraphNode } from '@interfaces/services/metagraph/IMetagraphService';
import ISshService from '@interfaces/services/ssh/ISshService';

export class Ssh2Service implements ISshService {
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

  async setConnection() {
    await new Promise((resolve, reject) => {
      this.connection
        .connect({
          host: this.ip,
          port: 22,
          username: this.username,
          privateKey: this.privateKey,
        })
        .on('ready', () => {
          this.logger.info(`[Node ${this.nodeNumber}] Connected successfully`);
          resolve(this.connection);
        })
        .on('error', (err) => {
          this.logger.error(`[Node ${this.nodeNumber}] Error when connecting`);
          reject(err);
        });
    });
  }

  public async executeCommand(command: string): Promise<string> {
    const conn = await this.connection;
    const commandParsed = this.defaultPath
      ? `cd ${this.defaultPath}
      ${command}
      `
      : command;

    return new Promise((resolve, reject) => {
      conn.exec(commandParsed, (err, stream) => {
        if (err) {
          this.logger.error(
            `[Node ${this.nodeNumber}] Error when running command ${commandParsed}. Error: ${err}`,
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
}
