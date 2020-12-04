import { EventEmitter } from 'events';
import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';

export default class ExpressServer extends EventEmitter {

  app = express();

  constructor() {
    super();
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
    
    this.app.listen(process.env.PORT || 3000, async () => {
      console.log(`Servidor HTTP corriendo en el puerto ${process.env.PORT || 3000}`);
      
      
    });
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