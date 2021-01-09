import { EventEmitter } from 'events';
import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import fs from "fs";
import http from "http";
import https from "https";

import logger from "./common/logger";

var privateKey: any;
var certificate: any;

export default class ExpressServer extends EventEmitter {

  app = express();
  httpServer: any;
  httpsServer: any;
  verifyToken: string;
  appSecret: string;

  constructor(verifyToken: string, appSecret: string) {
    super();
    this.verifyToken = verifyToken;
    this.appSecret = appSecret;

    try {
      if (process.env.PRIVATE_KEY_PATH && process.env.CERTIFICATE_PATH) {
        privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, 'utf8');
        certificate = fs.readFileSync(process.env.CERTIFICATE_PATH, 'utf8');
      }
    } catch (error) {
      logger.log({
        level: 'warn',
        message: `Error al cargar los certificados HTTPS: ${error}`
      });
    }
    

    this.app.use(bodyParser.json({ verify: this.verifyFacebookRequestSignature }));
    this.app.use(bodyParser.urlencoded({ extended: true }));
    
    this.app.get('/', (req: any, res: any) => {
      res.status(200).json({
        message: "API REST funcionando correctamente"
      });
    });
    
    this.app.get('/webhook', (req: any, res: any) => {
      if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === this.verifyToken) {
        res.send(req.query['hub.challenge']);
      } else {
        res.sendStatus(400);
      }
    });
    
    this.app.post('/webhook', (req: any, res: any) => {
      res.sendStatus(200);
      this.emit("facebookWebhook", req.body);
      
    });
    
    if (privateKey && certificate) {
      let credentials = {key: privateKey, cert: certificate};
      this.httpsServer = https.createServer(credentials, this.app);
      this.httpsServer.listen(process.env.PORT || 3000, async () => {
        logger.log({
          level: 'info',
          message: `Servidor HTTPS corriendo en el puerto ${process.env.PORT || 3000}`
        });
      });
    } else {
      this.httpServer = http.createServer(this.app); 
      this.httpServer.listen(process.env.PORT || 3000, async () => {
        logger.log({
          level: 'info',
          message: `Servidor HTTP corriendo en el puerto ${process.env.PORT || 3000}`
        });
      });
    }
  }

  verifyFacebookRequestSignature = (req: any, res: any, buf: any) => {
    const signature = req.headers['x-hub-signature'];
  
    if (signature) {
      
      const elements = signature.split('=');
      const signatureHash = elements[1];
      if (this.appSecret) {
        const expectedHash = crypto.createHmac('sha1', this.appSecret)
          .update(buf)
          .digest('hex');
  
        console.log(elements, signatureHash, expectedHash)
        if (signatureHash !== expectedHash) {
          //throw new Error('No se pudo validar la firma de Facebook');
        }
      }
      
    } else {
      //console.log(req.headers)
      throw new Error('No se pudo validar la firma de Facebook');
    }
  };
}