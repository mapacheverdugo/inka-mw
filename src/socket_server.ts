
import { EventEmitter } from "events";
import Net from 'net';

export default class SockerServer extends EventEmitter {
  server = new Net.Server();

  constructor(port: number) {
    super();

    this.server.listen(port, () => {
      console.log(`Servidor escuchando en: ${port}`);
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