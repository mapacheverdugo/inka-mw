import { EventEmitter } from 'events';
import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';

const fs = require('fs');
const http = require('http');
const https = require('https');

var privateKey: any;
var certificate: any;


export default class ExpressServer extends EventEmitter {

  app = express();
  httpServer: any;
  httpsServer: any;

  constructor() {
    super();

    if (process.env.PRIVATE_KEY_PATH && process.env.CERTIFICATE_PATH) {
      privateKey  = fs.readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8');
      certificate = fs.readFileSync(process.env.CERTIFICATE_PATH, 'utf8');
    }

    this.app.use(bodyParser.json({ verify: this.verifyFacebookRequestSignature }));
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    
    this.app.get('/webhook', (req: any, res: any) => {
      if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === process.env.FACEBOOK_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge']);
      } else {
        res.sendStatus(400);
      }
    });
    
    this.app.post('/webhook', (req: any, res: any) => {
      res.sendStatus(200);
      this.emit("facebookWebhook", req.body);
      
    });

    this.app.post('/telegram', (req: any, res: any) => {
      
      console.log(req.body);
      res.sendStatus(200);
      this.emit("telegramCode", req.body);
      
    });
    
    if (privateKey && certificate) {
      let credentials = {key: privateKey, cert: certificate};
      this.httpsServer = https.createServer(credentials, this.app);
      this.httpsServer.listen(process.env.PORT || 3000, async () => {
        console.log(`Servidor HTTPS corriendo en el puerto ${process.env.PORT || 3000}`);
      });
    } else {
      this.httpServer = http.createServer(this.app); 
      this.httpServer.listen(process.env.PORT || 3000, async () => {
        console.log(`Servidor HTTP corriendo en el puerto ${process.env.PORT || 3000}`);
      });
    }
  }

  verifyFacebookRequestSignature = (req: any, res: any, buf: any) => {
    const signature = req.headers['x-hub-signature'];
  
    if (!signature) {
      throw new Error('No se pudo validar la firma de Facebook');
    } else {
      const elements = signature.split('=');
      const signatureHash = elements[1];
      if (process.env.FACEBOOK_APP_SECRET) {
        const expectedHash = crypto.createHmac('sha1', process.env.FACEBOOK_APP_SECRET)
          .update(buf)
          .digest('hex');
  
        if (signatureHash !== expectedHash) {
          throw new Error('No se pudo validar la firma de Facebook');
        }
      }
    }
  };
}