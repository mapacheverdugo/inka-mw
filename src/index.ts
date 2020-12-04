
require('dotenv').config()

import { Pool } from 'pg';

import Instagram from "./controllers/instagram";
import Telegram from "./controllers/telegram";
import Facebook from "./controllers/facebook";
import SocketClient from './socket_client';
import SockerServer from './socket_server';

let igs: Instagram[] = [];
let fbs: Facebook[] = [];
let tgs: Telegram[] = [];

const pool = new Pool();

const sendToUser = (message: any) => {
  let founded;

  if (!founded) {
    for (const ig of igs) {
      founded = ig;
    }
  }

  if (!founded) {
    for (const fb of fbs) {
      founded = fb;
    }
  }

  if (!founded) {
    for (const tg of tgs) {
      founded = tg;
    }
  }

  if (founded) founded.sendMessage(message);
}

const getRows = async () => {
  return new Promise<any[]>(async (resolve, reject) => {
    pool.query('SELECT NOW()', (err, res) => {
      pool.end()
    });

    const res = await pool.query('SELECT * FROM inka_app');
    let rows = res.rows;
    resolve(rows);
  });
}

const main = async () => {
  try {
    const socketClient = new SocketClient();
    const socketServer = new SockerServer();

    socketServer.on("message", (message) => {
      sendToUser(message);
    });

    const rows = await getRows();

    for (const row of rows) {
      if (row.app_name.toLowerCase().trim() == process.env.INSTAGRAM_VALUE?.toLowerCase().trim()) {
        const appKey = row.app_data1.trim();
        const user = row.app_data2.trim();
        const password = row.app_data3.trim();
        let ig = new Instagram(user, password);
        ig.init();
        ig.on("message", (message: any) => {
          socketClient.write(message);
        });
        igs.push(ig);
      }

      if (row.app_name.toLowerCase().trim() == process.env.FACEBOOK_VALUE) {
        const appKey = row.app_data1.trim();
        const pageId = row.app_data2.trim();
        const accessToken = row.app_data3.trim();
        let fb = new Facebook(row.app_data1, row.app_data2);
        fb.init();
        fbs.push(fb);
      }

      if (row.app_name.toLowerCase().trim() == process.env.TELEGRAM_VALUE) {
        const appKey = row.app_data1.trim();
        const phone = row.app_data2.trim();
        let tg = new Telegram(phone);
        tg.init();
        tgs.push(tg);
      }
    }
    
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
  }
}

main();





