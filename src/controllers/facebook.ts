const { Messenger } = require('fbmessenger');

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

const showSelfMessages = true;
const showLogs = true;

export default class FacebookPage {
  messenger: any;

  constructor(pageAccessToken: string | undefined) {
    this.messenger = new Messenger({
      pageAccessToken
    });
  }

  init = async () => {
    try {
      this.startListener();
    } catch (error) {
      console.log("Error", error)
    }
  }

  handle = async (body: any) => {
    return this.messenger.handle(body);
  }

  startListener = () => {
    if (showLogs) console.log(`[Facebook] Acceso correcto. Escuchando mensajes...`);

    this.messenger.on('message', async (message: any) => {
      console.log(`[Facebook] Mensaje recibido dentro de la clase:`, message);
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
    
  }
}
