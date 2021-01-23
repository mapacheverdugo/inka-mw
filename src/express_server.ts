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
  facebookApps: Array<any> = [];

  constructor() {
    super();

    try {
      if (process.env.PRIVATE_KEY_PATH && process.env.CERTIFICATE_PATH) {
        privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH);
        certificate = fs.readFileSync(process.env.CERTIFICATE_PATH);
      }
    } catch (error) {
      logger.log({
        level: 'warn',
        message: `Error al cargar los certificados HTTPS: ${error}`
      });
    }
    
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.app.get('/', (req: any, res: any) => {
      res.status(200).json({
        message: "API REST funcionando correctamente"
      });
    });

    this.app.post('/instagram/login/:type', (req: any, res: any) => {
      if (req.params.type && req.params.type.toLowerCase() == "2fa") {
        this.emit("instagramTwoFactor", req.body.appKey, req.body.code.toString());
        res.status(200).json({
          appName: "Instagram",
          appKey: req.body.appKey,
          type: req.params.type.toLowerCase(),
          message: "Se envió la petición correctamente. Revisa los logs."
        });
      } else if (req.params.type && req.params.type.toLowerCase() == "verification") {
        this.emit("instagramVerification", req.body.appKey, req.body.code.toString());
        res.status(200).json({
          appName: "Instagram",
          appKey: req.body.appKey,
          type: req.params.type.toLowerCase(),
          message: "Se envió la petición correctamente. Revisa los logs."
        });
      } else {
        res.status(404).json({
          appName: "Instagram",
          message: "Petición incorrecta."
        });
      }
    });

    this.app.get('/facebook/webhook/:appKey', bodyParser.json({ verify: this.verifyFacebookRequestSignature }), (req: any, res: any) => {
      if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === this.facebookApps[0].verifyToken) {
        res.send(req.query['hub.challenge']);
      } else {
        res.sendStatus(400);
      }
    });
    
    this.app.post('/facebook/webhook/:appKey', bodyParser.json({ verify: this.verifyFacebookRequestSignature }), (req: any, res: any) => {
      console.log("this.facebookApps", this.facebookApps);
      res.sendStatus(200);
      logger.log({
        level: 'debug',
        message: `Se recibió: ${JSON.stringify(req.body)}`
      });
      this.emit("facebookWebhook", req.params.appKey, req.body);
      
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

  addFacebookWebhooks = (facebookApps: Array<any>) => {
    this.facebookApps = facebookApps;
    
    
  }

  verifyFacebookRequestSignature = (req: any, res: any, buf: any) => {
    const signature = req.headers['x-hub-signature'];
  
    if (signature) {
      
      const elements = signature.split('=');
      const signatureHash = elements[1];
      if (this.facebookApps[0].appSecret) {
        const expectedHash = crypto.createHmac('sha1', this.facebookApps[0].appSecret)
          .update(buf)
          .digest('hex');
  
        if (signatureHash !== expectedHash) {
          //throw new Error('No se pudo validar la firma de Facebook');
        }
      }
      
    } else {
      throw new Error('No se pudo validar la firma de Facebook');
    }
  };
}