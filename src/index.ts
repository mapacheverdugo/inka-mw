
require('dotenv').config()

import { Pool } from 'pg';

import Instagram from "./controllers/instagram";
import Facebook from "./controllers/facebook";
import SocketClient from './socket_client';
import SockerServer from './socket_server';
import ExpressServer from './express_server';

import logger from "./common/logger";

const pool = new Pool();

let igs: Instagram[] = [];
let fbs: Facebook[] = [];

const foundSocial = (appKey: string) => {
  let founded;

  if (!founded) {
    for (const ig of igs) {
      if (ig.appKey == appKey)
        founded = ig;
    }
  }

  if (!founded) {
    for (const fb of fbs) {
      if (fb.appKey == appKey)
        founded = fb;
    }
  }
  return founded;
}

const sendToUser = (message: any) => {
  const founded = foundSocial(message.keyApp)
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

      expressServer.on("instagramVerification", (appKey: any, code: string) => {
        const ig = foundSocial(appKey);
        if (ig && ig instanceof Instagram) {
          ig.verificateLogin(code);
        } else {
          logger.log({
            level: 'warn',
            message: `La clase con el appKey ${appKey} es incorrecta: ${ig}`
          });
        }
      });

      expressServer.on("instagramTwoFactor", (appKey: any, code: string) => {
        const ig = foundSocial(appKey);
        if (ig && ig instanceof Instagram) {
          ig.twoFactorLogin(code);
        } else {
          logger.log({
            level: 'warn',
            message: `La clase con el appKey ${appKey} es incorrecta: ${ig}`
          });
        }
      });
    }

    if (process.env.FACEBOOK_PORT) {
      const facebookSocket = new SockerServer(parseInt(process.env.FACEBOOK_PORT));
      facebookSocket.on("message", (message) => {
        sendToUser(message);
      });

      expressServer.on("facebookWebhook", (appKey: any, data: any) => {
        const fb = foundSocial(appKey);
        if (fb && fb instanceof Facebook) {
          fb.handle(data);
        } else {
          logger.log({
            level: 'warn',
            message: `La clase con el appKey ${appKey} es incorrecta: ${fb}`
          });
        }
      });
    }

    let facebookApps = [];

      const rows = await getRows();
      for (const row of rows) {
        if (row.app_name.toLowerCase().trim() == process.env.INSTAGRAM_VALUE?.toLowerCase().trim()) {
          try {
            const appKey = row.app_data1 ? row.app_data1.trim() : null;;
            const user = row.app_data2 ? row.app_data2.trim() : null;
            const password = row.app_data3 ? row.app_data3.trim() : null;
            const coreHost = row.app_data7 ? row.app_data7.trim() : null;
            if (appKey && user && password && coreHost) {
              let ig = new Instagram(appKey, user, password);
              ig.init();
              ig.on("message", (message: any) => {
                const socketClient = new SocketClient(coreHost);
                socketClient.write(message);
              });
              igs.push(ig);
            }
          } catch (error) {
            logger.log({
              level: 'error',
              message: error
            });
          }
          
        }
  
        if (row.app_name.toLowerCase().trim() == process.env.FACEBOOK_VALUE?.toLowerCase().trim()) {
          const appKey = row.app_data1 ? row.app_data1.trim() : null;
          const pageId = row.app_data2 ? row.app_data2.trim() : null;
          const accessToken = row.app_data3 ? row.app_data3.trim() : null;
          const verifyToken = row.app_data4 ? row.app_data4.trim() : null;
          const appSecret = row.app_data5 ? row.app_data5.trim() : null;
          const coreHost = row.app_data7 ? row.app_data7.trim() : null;
          if (appKey && pageId && accessToken && verifyToken && appSecret && coreHost) {
            let fb = new Facebook(appKey, pageId, accessToken);
            fb.init();
    
            fb.on("message", (message: any) => {
              const socketClient = new SocketClient(coreHost);
              socketClient.write(message);
            });
            fbs.push(fb);
          }
  
          facebookApps.push({appKey, verifyToken, appSecret});
  
          expressServer.facebookApps = facebookApps;
        }
      }
  } catch (error) {
    logger.log({
      level: 'error',
      message: error
    });
  }
}

main();





