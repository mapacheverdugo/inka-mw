
require('dotenv').config()

import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import bodyParser from 'body-parser';
const {
  Messenger,
  Button,
  Element,
  Image,
  Video,
  GenericTemplate,
  GreetingText,
  PersistentMenuItem,
  PersistentMenu,
  QuickReply,
  QuickReplies,
  ReceiptTemplate,
  ListTemplate,
  Address,
  Summary,
  Adjustment,
} = require('fbmessenger');

import Instagram from "./controllers/instagram";
import Telegram from "./controllers/telegram";
import Facebook from "./controllers/facebook";

const app = express();

const verifyRequestSignature = (req: any, res: any, buf: any) => {
  const signature = req.headers['x-hub-signature'];

  if (!signature) {
    throw new Error('Couldn\'t validate the signature.');
  } else {
    const elements = signature.split('=');
    const signatureHash = elements[1];
    if (process.env.FACEBOOK_APP_SECRET) {
      const expectedHash = crypto.createHmac('sha1', process.env.FACEBOOK_APP_SECRET)
        .update(buf)
        .digest('hex');

      if (signatureHash !== expectedHash) {
        throw new Error('Couldn\'t validate the request signature.');
      }
    }
  }
};

app.use(bodyParser.json({ verify: verifyRequestSignature }));
app.use(bodyParser.urlencoded({ extended: true }));

const fb = new Facebook(process.env.FACEBOOK_PAGE_TOKEN_1);

(async () => {
    try {
      //let ig = new Instagram(process.env.INSTAGRAM_USER, process.env.INSTAGRAM_PASS);
      //ig.init();

      //let tg = new Telegram("56965830745");
      //tg.init();
      
      fb.init();
    } catch (error) {
      console.error("Error:", error);
    }
})();

app.get('/webhook', (req: any, res: any) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === process.env.FACEBOOK_VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.post('/webhook', (req: any, res: any) => {
  res.sendStatus(200);
  fb.handle(req.body);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor HTTP corriendo en el puerto ${process.env.PORT || 3000}`);
});