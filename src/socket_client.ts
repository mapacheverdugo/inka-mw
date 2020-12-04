
require('dotenv').config()

import { EventEmitter } from 'events';
import Net from 'net';

export default class SocketClient extends EventEmitter{
  client = new Net.Socket();

  constructor() {
    super();
    if (process.env.CORE_HOST && process.env.CORE_PORT) {
      this.client.connect({ 
        port: parseInt(process.env.CORE_PORT),
        host: process.env.CORE_HOST
      });


      this.client.on('connect', async () => {
        console.log("Conectado correctamente al Core");
      });
    }
  }

  write = (message: any) => {
    let messageReady = JSON.stringify(message) + "\r";
    this.client.write(messageReady);
  } 
}