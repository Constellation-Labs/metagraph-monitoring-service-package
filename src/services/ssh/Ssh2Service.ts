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
  private password?: string;
  private privateKey: Buffer;
  private privateKeyPassword?: string;
  private defaultPath?: string;

  nodeNumber: number;
  connection: Client;
  metagraphNode: MetagraphNode;
  loggerService: ILoggerService;

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
    this.privateKey = fs.readFileSync(myFilePath);
    this.privateKeyPassword = metagraphNode.privateKeyPassword;
    this.defaultPath = defaultPath;
    this.metagraphNode = metagraphNode;
    this.connection = new Client();
  }

  private async customLogger(message: string, level: 'info' | 'error') {
    if (level === 'error') {
      this.loggerService.error(`[Ssh2Service] ${message}`);
    } else {
      this.loggerService.info(`[Ssh2Service] ${message}`);
    }
  }

  public async setConnection() {
    this.connection = new Client();
    await new Promise((resolve, reject) => {
      this.connection
        .connect({
          host: this.ip,
          port: 22,
          username: this.username,
          password: this.password || '',
          privateKey: this.privateKey,
          passphrase: this.privateKeyPassword || '',
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

  public async executeCommand(
    command: string,
    ignoreErrors = true,
  ): Promise<string> {
    const conn = await this.connection;
    const commandParsed = this.defaultPath
      ? `cd ${this.defaultPath} && sudo ${command}`
      : `sudo ${command}`;

    return new Promise((resolve, reject) => {
      conn.exec(commandParsed, (err, stream) => {
        if (err) {
          this.customLogger(
            `[Node ${this.nodeNumber}] Error when running command ${commandParsed}. Error: ${err}`,
            'error',
          );
          return reject(err);
        }

        let data = '';
        let errorData = '';

        stream
          .on('close', (code: number) => {
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
          });
      });
    });
  }

  public async destroyConnection() {
    (await this.connection).end();
    (await this.connection).destroy();
  }
}
