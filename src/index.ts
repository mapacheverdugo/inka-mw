
require('dotenv').config()

import { Pool } from 'pg';

import Instagram from "./controllers/instagram";
import Facebook from "./controllers/facebook";
import SocketClient from './socket_client';
import SockerServer from './socket_server';
import ExpressServer from './express_server';

let igs: Instagram[] = [];
let fbs: Facebook[] = [];

const pool = new Pool();

const sendToUser = (message: any) => {
  let founded;

  if (!founded) {
    for (const ig of igs) {
      if (ig.appKey == message.keyApp)
        founded = ig;
    }
  }

  if (!founded) {
    for (const fb of fbs) {
      if (fb.appKey == message.keyApp)
        founded = fb;
    }
  }

  if (founded) founded.sendMessage(message);
}

const getRows = async () => {
  return new Promise<any[]>(async (resolve, reject) => {
    pool.query('SELECT NOW()', (err, res) => {
      if (err) reject(new Error("No se pudo establecer conección con la base de datos"));
      pool.end();
    });

    try {
      const res = await pool.query('SELECT * FROM inka_app WHERE app_activo = 1');
      let rows = res.rows;
      resolve(rows);
    } catch (error) {
      reject(new Error("No se pudieron obtener las redes sociales desde la base de datos"));
    }
  });
}

const main = async () => {
  try {
    const expressServer = new ExpressServer();

    if (process.env.INSTAGRAM_PORT) {
      const instagramSocket = new SockerServer(parseInt(process.env.INSTAGRAM_PORT));
      instagramSocket.on("message", (message) => {
        sendToUser(message);
      });
    }

    if (process.env.FACEBOOK_PORT) {
      const facebookSocket = new SockerServer(parseInt(process.env.FACEBOOK_PORT));
      facebookSocket.on("message", (message) => {
        sendToUser(message);
      });
    }

      const rows = await getRows();
      for (const row of rows) {
        if (row.app_name.toLowerCase().trim() == process.env.INSTAGRAM_VALUE?.toLowerCase().trim()) {
          try {
            const appKey = row.app_data1.trim();
            const user = row.app_data2.trim();
            const password = row.app_data3.trim();
            const coreHost = row.app_data7.trim();
            let ig = new Instagram(appKey, user, password);
            ig.init();
            ig.on("message", (message: any) => {
              const socketClient = new SocketClient(coreHost);
              socketClient.write(message);
            });
            igs.push(ig);
          } catch (error) {
            console.log(error);
          }
          
        }
  
        if (row.app_name.toLowerCase().trim() == process.env.FACEBOOK_VALUE?.toLowerCase().trim()) {
          const appKey = row.app_data1.trim();
          const pageId = row.app_data2.trim();
          const accessToken = row.app_data3.trim();
          const verifyToken = row.app_data4.trim();
          const appSecret = row.app_data5.trim();
          const coreHost = row.app_data7.trim();
          let fb = new Facebook(appKey, pageId, accessToken);
          fb.init();
          expressServer.on("facebookWebhook", (data) => {
            fb.handle(data);
          })
          fb.on("message", (message: any) => {
            const socketClient = new SocketClient(coreHost);
            socketClient.write(message);
          });
          fbs.push(fb);
        }
      }
  } catch (error) {
    console.error(error);
  }
}

main();





