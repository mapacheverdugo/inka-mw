
import { EventEmitter } from "events";
import Net from 'net';

export default class SockerServer extends EventEmitter {
  server = new Net.Server();

  constructor() {
    super();

    this.server.listen(process.env.INSTAGRAM_PORT, () => {
      console.log(`Servidor escuchando en: ${process.env.INSTAGRAM_PORT}`);
    });
      
    this.server.on('connection', (socket: any) => {
      console.log('Se establecio una nueva conexion.');

      socket.on('data', (chunk: any) => {
        if (chunk) {
          const message = JSON.parse(chunk.toString());
          console.log("message", message);
          this.emit("message", message);
          socket.write(JSON.stringify({"code":"000","description":"Success Proccess"}) + "\r");
        }
      });

      socket.on('error', (err: any) => {
          console.log(`Error: ${err}`);
      });
    });
  }

   
}