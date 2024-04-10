import fs from 'fs';
import path from 'path';

import { Client } from 'ssh2';

import 'module-alias';
import { MetagraphNode } from '@interfaces/metagraph/types';
import ISshService from '@interfaces/ssh/ISshService';

export class Ssh2Service implements ISshService {
  private ip: string;
  private username: string;
  private privateKey: Buffer;
  private defaultPath?: string;

  public nodeNumber: number;
  public connection: Client;
  public metagraphNode: MetagraphNode;

  constructor(
    nodeNumber: number,
    metagraphNode: MetagraphNode,
    defaultPath?: string,
  ) {
    this.nodeNumber = nodeNumber;
    this.ip = metagraphNode.ip;
    this.username = metagraphNode.username;
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
          console.log(`[Node ${this.nodeNumber}] Connected successfully`);
          resolve(this.connection);
        })
        .on('error', (err) => {
          console.log(`[Node ${this.nodeNumber}] Error when connecting`);
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
          console.log(
            `[Node ${this.nodeNumber}] Error when running comm2and ${commandParsed}. Error: ${err}`,
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
            console.log(`[Node ${this.nodeNumber}] Command output: ${data}`);
            resolve(data);
          })
          .on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
      });
    });
  }
}
