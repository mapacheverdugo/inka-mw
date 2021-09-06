
require('dotenv').config()

import { Pool } from 'pg';
import logger from "./common/logger";
import Facebook from "./controllers/facebook";
import Instagram from "./controllers/instagram";
import ExpressServer from './express_server';
import SocketClient from './socket_client';
import SockerServer from './socket_server';



const pool = new Pool();

let igClients: Instagram[] = [];
let fbClients: Facebook[] = [];

export const foundClientByAppKey = (appKey: string) => {
  let founded;

  if (!founded) {
    for (const waClient of igClients) {
      if (waClient.appKey == appKey)
        founded = waClient;
    }
  }

  if (!founded) {
    for (const waClient of fbClients) {
      if (waClient.appKey == appKey)
        founded = waClient;
    }
  }
  return founded;
}

const sendToUser = (message: any) => {
  const founded = foundClientByAppKey(message.keyApp)
  if (founded) founded.sendMessage(message);
}

const getRows = async () => {
  let pool = new Pool();
  pool.query('SELECT NOW()', (err: any, res: any) => {
    if (err) throw new Error(`No se pudo establecer conexión con la base de datos. Error: ${err}`);
    pool.end();
  });

  try {
    const res = await pool.query('SELECT * FROM inka_app WHERE app_activo = 1');
    let rows = res.rows;
    return rows;
  } catch (error) {
    throw new Error("No se pudieron obtener las redes sociales desde la base de datos");
  }
}

const loadClients = async (firstTime: boolean = false) => {
  try {
    const rows = await getRows();

    let dataBaseAppKeys: any[] = [];

    // Crea los clientes desde la base de datos
    for (const row of rows) {
      if (row.app_name.toLowerCase().trim() == process.env.INSTAGRAM_VALUE?.toLowerCase().trim()) {

        const appKey = row.app_data1 ? row.app_data1.trim() : null;;
        const user = row.app_data2 ? row.app_data2.trim() : null;
        const password = row.app_data3 ? row.app_data3.trim() : null;
        const coreHost = row.app_data7 ? row.app_data7.trim() : null;
        if (appKey && user && password && coreHost) {
          dataBaseAppKeys.push(appKey);

          let client = foundClientByAppKey(appKey);

          if (!client) {
            if (!firstTime) {
              logger.log({
                level: 'info',
                message: `Creando cliente ${appKey}...`
              });
            }
            let ig = new Instagram(appKey, user, password);
            await ig.init();

            ig.on("message", (message: any) => {
              const socketClient = new SocketClient(coreHost);
              socketClient.write(message);
            });
            igClients.push(ig);
          }

        } else {
          logger.log({
            level: 'warn',
            message: `Datos faltantes para el cliente ${appKey}`
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
          dataBaseAppKeys.push(appKey);

          let client = foundClientByAppKey(appKey);

          // Lo crea solo si no existe
          if (!client) {
            if (!firstTime) {
              logger.log({
                level: 'info',
                message: `Creando cliente ${appKey}...`
              });
            }
            let fb = new Facebook(appKey, pageId, accessToken);
            await fb.init();

            fb.on("message", (message: any) => {
              const socketClient = new SocketClient(coreHost);
              socketClient.write(message);
            });
            fbClients.push(fb);

            /*           facebookApps.push({ appKey, verifyToken, appSecret });
            
                      expressServer.facebookApps = facebookApps; */
          }


        } else {
          logger.log({
            level: 'warn',
            message: `Datos faltantes para el cliente ${appKey}`
          });
        }


      }
    }


    if (!firstTime) {
      // Elimina los clientes que no estan activos
      let deletedIgClients: any[] = igClients.filter(client => {
        return !dataBaseAppKeys.includes(client.appKey);
      });
      let deletedFbClients: any[] = fbClients.filter(client => {
        return !dataBaseAppKeys.includes(client.appKey);
      });
      let deletedClients: any[] = deletedIgClients.concat(deletedFbClients);

      for (const client of deletedClients) {
        logger.log({
          level: 'info',
          message: `Eliminando cliente ${client.appKey}...`
        });
        client.removeAllListeners();
        await client.destroy();
        fbClients = fbClients.filter(fb => fb.appKey != client.appKey);
        igClients = igClients.filter(ig => ig.appKey != client.appKey);
      }
    }
  } catch (error) {
    logger.log({
      level: 'error',
      message: error
    });
  }
}

const printClients = () => {
  let appKeys = [];
  for (const client of igClients) {
    appKeys.push(client.appKey);
  }
  for (const client of fbClients) {
    appKeys.push(client.appKey);
  }

  logger.log({
    level: 'silly',
    message: "App keys: " + JSON.stringify(appKeys),
  });
}

const main = async () => {
  try {
    const expressServer = new ExpressServer();
    expressServer.on("refreshClients", async () => {
      await loadClients();
      printClients();
    });

    if (process.env.INSTAGRAM_PORT) {
      const instagramSocket = new SockerServer(parseInt(process.env.INSTAGRAM_PORT));
      instagramSocket.on("message", (message) => {
        sendToUser(message);
      });

      expressServer.on("instagramVerification", (appKey: any, code: string) => {
        const ig = foundClientByAppKey(appKey);
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
        const ig = foundClientByAppKey(appKey);
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
        const fb = foundClientByAppKey(appKey);

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

    await loadClients(true);
    printClients();

  } catch (error) {
    logger.log({
      level: 'error',
      message: error
    });
  }
}
/* 
const main = async () => {
  try {
    const expressServer = new ExpressServer();

    if (process.env.INSTAGRAM_PORT) {
      const instagramSocket = new SockerServer(parseInt(process.env.INSTAGRAM_PORT));
      instagramSocket.on("message", (message) => {
        sendToUser(message);
      });

      expressServer.on("instagramVerification", (appKey: any, code: string) => {
        const ig = foundClientByAppKey(appKey);
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
        const ig = foundClientByAppKey(appKey);
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
        const fb = foundClientByAppKey(appKey);

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

        facebookApps.push({ appKey, verifyToken, appSecret });

        expressServer.facebookApps = facebookApps;
      }
    }
  } catch (error) {
    logger.log({
      level: 'error',
      message: error
    });
  }
} */

main();





