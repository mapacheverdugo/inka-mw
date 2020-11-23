
require('dotenv').config()

import dotenv from 'dotenv';
import crypto from 'crypto';
import express from 'express';
import bodyParser from 'body-parser';

import Instagram from "./controllers/instagram";
import Telegram from "./controllers/telegram";
import Facebook from "./controllers/facebook";

(async () => {
    try {
      let ig = new Instagram(process.env.INSTAGRAM_USER, process.env.INSTAGRAM_PASS);
      ig.init();

      //let tg = new Telegram("56965830745");
      //tg.init();

      let fb = new Facebook(process.env.FACEBOOK_PAGE_TOKEN);
      fb.init();
    } catch (error) {
      console.error("Error:", error);
    }
})();

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

const messenger = new Messenger({
  pageAccessToken: process.env.FACEBOOK_PAGE_TOKEN,
});

/* const WHITELISTED_DOMAINS = [
  'https://bbc.co.uk',
  'https://stackoverflow.com',
];
 */
const timeout = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

messenger.on('message', async (message: any) => {
  console.log(`Message received:`, message);
  /* const recipient = message.sender.id;

  // Allow receiving locations
  if ('attachments' in message.message) {
    const msgType = message.message.attachments[0].type;
    if (msgType === 'location') {
      console.log('Location received');
      const text = `${message.message.attachments[0].title}:
                    lat: ${message.message.attachments[0].payload.coordinates.lat},
                    long: ${message.message.attachments[0].payload.coordinates.long}`;
      await messenger.send({ text }, recipient);
    }

    if (['audio', 'video', 'image', 'file'].includes(msgType)) {
      const attachment = message.message.attachments[0].payload.url;
      console.log(`Attachment received: ${attachment}`);
    }
  }

  // Text messages
  if ('text' in message.message) {
    let msg = message.message.text;
    msg = msg.toLowerCase();

    if (msg.includes('text')) {
      await messenger.send({ text: 'This is an example text message.' }, recipient);
    }

    if (msg.includes('image')) {
      const res = await messenger.send(new Image({
        url: 'https://unsplash.it/300/200/?random',
        is_reusable: true,
      }), recipient);
      console.log(`Resuable attachment ID: ${res.attachment_id}`);
    }

    if (msg.includes('reuse')) {
      await messenger.send(new Image({ attachment_id: 947782652018100 }), recipient);
    }

    if (msg.includes('video')) {
      try {
        await messenger.send(new Video({
          url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        }), recipient);
      } catch (e) {
        console.error(e);
      }
    }

    if (msg.includes('payload')) {
      const pl = message.message.quick_reply.payload;
      const text = `User clicked button: ${msg}, Button payload is: ${pl}`;
      await messenger.send({ text }, recipient);
    }

    if (msg.includes('code')) {
      const result = await messenger.messengerCode();
      await messenger.send({ text: result.uri }, recipient);
    }

    if (msg.includes('nlp')) {
      const result = await messenger.setNLP(true);
      await messenger.send({ text: result.success }, recipient);
    }

    if (msg.includes('list')) {
      const element1 = new Element({
        title: 'BBC news',
        subtitle: 'Catch up on the latest news',
        image_url: 'https://unsplash.it/300/200/?random',
        default_action: {
          type: 'web_url',
          url: 'https://bbc.co.uk/news',
        },
      });
      const element2 = new Element({
        title: 'BBC weather',
        subtitle: 'See the weather forecast',
        default_action: {
          type: 'web_url',
          url: 'https://bbc.co.uk/weather',
        },
      });
      const elements = [element1, element2];
      const template = new ListTemplate({
        top_element_style: 'large',
        elements,
      });
      await messenger.send(template, recipient);
    }

    if (msg.includes('bubble')) {
      const element = new Element({
        title: 'Example bubble',
        item_url: 'http://www.bbc.co.uk',
        image_url: 'https://unsplash.it/300/200/?random',
        subtitle: 'Opens bbc.co.uk',
        buttons: [
          new Button({
            type: 'web_url',
            title: 'BBC',
            url: 'http://www.bbc.co.uk',
          }),
        ],
      });
      await messenger.send(new GenericTemplate({
        elements: [element],
      }), recipient);
    }

    if (msg.includes('quick replies')) {
      const qr1 = new QuickReply({ title: 'Location', content_type: 'location' });
      const qr2 = new QuickReply({ title: 'Payload', payload: 'QUICK_REPLY_PAYLOAD' });
      const qrs = new QuickReplies([qr1, qr2]);
      await messenger.send(Object.assign(
        { text: 'This is an example with quick replies.' },
        qrs,
      ), recipient);
    }
 */
    /* if (msg.includes('compact')) {
      const btn = getButton('compact');
      const elem = getElement(btn);
      await messenger.send(new GenericTemplate([elem]), recipient);
    }

    if (msg.includes('tall')) {
      const btn = getButton('tall');
      const elem = getElement(btn);
      await messenger.send(new GenericTemplate([elem]), recipient);
    }

    if (msg.includes('full')) {
      const btn = getButton('full');
      const elem = getElement(btn);
      await messenger.send(new GenericTemplate([elem]), recipient);
    } */

   /*  if (msg.includes('multiple')) {
      await messenger.send({ text: 'Message 1' }, recipient);
      await timeout(3000);
      await messenger.send({ text: 'Message 2' }, recipient);
    }
 */
    /* if (msg.includes('receipt')) {
      const template = new ReceiptTemplate({
        recipient_name: 'Name',
        order_number: '123',
        currency: 'USD',
        payment_method: 'Visa',
        order_url: 'http://www.example.com',
        timestamp: '123123123',
        elements: [
          new Element({
            title: 'Title',
            subtitle: 'Subtitle',
            quantity: 1,
            price: 12.50,
            currency: 'USD',
          }),
        ],
        address: new Address({
          street_1: '1 Hacker Way',
          street_2: '',
          city: 'Menlo Park',
          postal_code: '94025',
          state: 'CA',
          country: 'US',
        }),
        summary: new Summary({
          subtotal: 75.00,
          shipping_cost: 4.95,
          total_tax: 6.19,
          total_cost: 56.14,
        }),
        adjustments: [
          new Adjustment({
            name: 'Adjustment',
            amount: 20,
          }),
        ],
      });
      const res = await messenger.send(template, recipient);
      console.log(res);
    } 
  }*/
});


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
  messenger.handle(req.body);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Corriendo en el puerto ${process.env.PORT || 3000}`);
});