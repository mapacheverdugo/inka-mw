
import { EventEmitter } from "events";
import Net from 'net';
import logger from "./common/logger";


export default class SockerServer extends EventEmitter {
  server = new Net.Server();

  constructor(port: number) {
    super();

    this.server.listen(port, () => {
      logger.log({
        level: 'debug',
        message: `Servidor socket TCP escuchando en ${port}`
      });
    });
      
    this.server.on('connection', (socket: any) => {
      logger.log({
        level: 'debug',
        message: `Se recibió una nueva conexión al servidor socket`
      });

      socket.on('data', (chunk: any) => {
        if (chunk) {
          try {
            const message = JSON.parse(chunk.toString());
            logger.log({
              level: 'debug',
              message: `Recibido: ${JSON.stringify(message)}`
            });
            this.emit("message", message);
            socket.write(JSON.stringify({"code":"000","description":"Success Proccess"}) + "\r");
          } catch (e) {
            logger.log({
              level: 'warn',
              message: `No se pudieron procesar los datos recibidos: ${chunk.toString()}`
            });
            //socket.end();
          }
        }
      });

      socket.on('error', (err: any) => {
        
        logger.log({
          level: 'error',
          message: `Error en el servidor socket: ${err}`
        });
      });
    });
  }

   
}