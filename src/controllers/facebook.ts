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
    body.entry.map((entry: any) => {
      entry.messaging.map((messaging: any) => {
        console.log(messaging, messaging.message, messaging.message.attachments)
      })
    })
    return this.messenger.handle(body);
    
  }

  startListener = () => {
    if (showLogs) console.log(`[Facebook] Acceso correcto. Escuchando mensajes...`);

    this.messenger.on('message', async (message: any) => {
      if (showLogs) this.logMessage(message);
      let parsedMessage = await this.parseMessage(message);
      //console.log(parsedMessage);
    });
    
  }

  logMessage = (message: any) => {
    const recipient = message.recipient.id;

    //console.log(message);
      
    if ('attachments' in message.message) {
      const msgType = message.message.attachments[0].type;
      if (msgType === 'location') {
        console.log('Location received');
        const text = `${message.message.attachments[0].title}:
                      lat: ${message.message.attachments[0].payload.coordinates.lat},
                      long: ${message.message.attachments[0].payload.coordinates.long}`;

      }
  
      if (['audio', 'video', 'image', 'file'].includes(msgType)) {
        const attachment = message.message.attachments[0].payload.url;
        console.log(`Attachment received: ${attachment}`);
      }
    } else if ('text' in message.message) {
      console.log(`[Facebook - ${recipient}] Mensaje recibió:`, message.message.text);
    }
  }

  parseMessage = (message: any) => {
    return new Promise(async (resolve, reject) => {
      const recipient = message.recipient.id;
      const sender = message.sender.id;

      let attachmentType;
      let attachmentUrl;
      let mensajeTexto;

      if ('text' in message.message) {
        mensajeTexto = message.message.text;
      }

      let user;

      try {
        user = await this.messenger.getUser(sender, [
          'first_name',
          'last_name'
        ])
      } catch (error) {
        console.log("Error obteniendo user:", error);
      }


      resolve({
        keyApp: recipient,
        userKey: sender,
        msj: {
          userName: user ? `${user.first_name} ${user.last_name}` : "NN",
          type: "PV",
          attachmentType,
          attachmentUrl,
          mensajeTexto,
        },
        type: "new_message"
      });
    })
  }
}
