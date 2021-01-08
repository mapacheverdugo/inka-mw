
require('dotenv').config()

import { EventEmitter } from 'events';
import Net from 'net';
import logger from "./common/logger";

export default class SocketClient extends EventEmitter{
  host: string;
  client = new Net.Socket();

  constructor(host: string) {
    super();
    this.host = host;
  }

  write = (message: any) => {
    if (this.host && process.env.CORE_PORT) {
      this.client.connect({ 
        port: parseInt(process.env.CORE_PORT),
        host: this.host
      });
  
      this.client.on('connect', async () => {
        logger.log({
          level: 'debug',
          message: `Conectado correctamente como cliente al socket del Core ${this.host}:${process.env.CORE_PORT}`
        });
        let messageReady = JSON.stringify(message) + "\r";
        this.client.write(messageReady);
        logger.log({
          level: 'debug',
          message: `Enviado: ${message}`
        });
        this.client.end();
  
        
      });

      this.client.on("error", (err) => {
        logger.log({
          level: 'error',
          message: `Conectado correctamente como cliente al socket del Core ${this.host}:${process.env.CORE_PORT}. Error: ${err}`
        });
        this.client.end();
      })
    } 
      
    }
    
  
}