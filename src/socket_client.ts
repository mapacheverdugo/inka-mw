
require('dotenv').config()

import { EventEmitter } from 'events';
import Net from 'net';

export default class SocketClient extends EventEmitter{
  client = new Net.Socket();

  constructor() {
    super();
    
  }

  write = (message: any) => {
    if (process.env.CORE_HOST && process.env.CORE_PORT) {
      this.client.connect({ 
        port: parseInt(process.env.CORE_PORT),
        host: process.env.CORE_HOST
      });
  
      this.client.on('connect', async () => {
        console.log("Conectado correctamente al Core");
        let messageReady = JSON.stringify(message) + "\r";
        this.client.write(messageReady);
        console.log("Enviado:", message)
        this.client.end();
  
        this.client.on("error", (err) => {
          console.log("Error mandandao mensaje: ", err);
          this.client.end();
        })
      });
    } 
      
    }
    
  
}