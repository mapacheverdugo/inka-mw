
require('dotenv').config()

import { EventEmitter } from 'events';
import Net from 'net';

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
        console.log("Conectado correctamente al Core");
        let messageReady = JSON.stringify(message) + "\r";
        this.client.write(messageReady);
        console.log("Enviado:", message)
        this.client.end();
  
        
      });

      this.client.on("error", (err) => {
        console.log("Error al conectarse al Core: ", err);
        this.client.end();
      })
    } 
      
    }
    
  
}