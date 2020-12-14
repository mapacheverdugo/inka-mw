import {EventEmitter} from "events";

const { Messenger, Text, Audio, Video, Image, File } = require('fbmessenger');

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";
const FILE_TYPE = "file";
const GEO_TYPE = "geo";

const showLogs = true;

export default class FacebookPage extends EventEmitter {
  messenger: any;
  pageId: any;

  constructor(pageId: string | undefined, pageAccessToken: string | undefined) {
    super();
    this.messenger = new Messenger({
      pageAccessToken
    });
    this.pageId = pageId;
  }

  init = async () => {
    try {
      this.startListener();
    } catch (error) {
      console.log("Error", error)
    }
  }

  handle = async (body: any) => {/* 
    body.entry.map((entry: any) => {
      entry.messaging.map((messaging: any) => {
        console.log(messaging, messaging.message, messaging.message.attachments)
      })
    }) */
    return this.messenger.handle(body);
    
  }

  startListener = () => {
    if (showLogs) console.log(`[Facebook] Acceso correcto. Escuchando mensajes...`);

    this.messenger.on('message', async (message: any) => {
      const recipient = message.recipient.id;

      if (this.pageId == recipient) {
        if (showLogs) this.logMessage(message);
        let parsedMessage = await this.parseMessage(message);
        console.log("Mensaje del cliente al core", parsedMessage);
        this.emit("message", parsedMessage);
        
      }
    });
    
  }

  logMessage = (message: any) => {
    const recipient = message.recipient.id;

    //console.log(message);

    if (this.pageId == recipient) {
      
    if ('attachments' in message.message) {
      const type = message.message.attachments[0].type;
      if (type == "location") {
        console.log(`[Facebook - ${recipient}] recibió una ubicación: https://www.google.com/maps/place/${message.message.attachments[0].payload.coordinates.lat},${message.message.attachments[0].payload.coordinates.long}`);
      } else if (type == "audio") {
        console.log(`[Facebook - ${recipient}] recibió un audio: ${message.message.attachments[0].payload.url}`);
      } else if (type == "video") {
        console.log(`[Facebook - ${recipient}] recibió un video: ${message.message.attachments[0].payload.url}`);
      } else if (type == "image") {
        console.log(`[Facebook - ${recipient}] recibió una imagen: ${message.message.attachments[0].payload.url}`);
      } else if (type == "file") {
        console.log(`[Facebook - ${recipient}] recibió un archivo: ${message.message.attachments[0].payload.url}`);
      } 
  
    } else if ('text' in message.message) {
      console.log(`[Facebook - ${recipient}] recibió: "${message.message.text}"`);
    }
  }
  }

  parseMessage = (message: any) => {
    return new Promise(async (resolve, reject) => {
      const recipient = message.recipient.id;
      const sender = message.sender.id;

      let attachmentType;
      let attachmentUrl;
      let mensajeTexto;

      if (this.pageId == recipient) {

      if ('text' in message.message) {
        mensajeTexto = message.message.text;
      }

      if ('attachments' in message.message) {
        const type = message.message.attachments[0].type;
        if (type == "location" && GEO_TYPE) {
          attachmentType == GEO_TYPE;
          attachmentUrl = `https://www.google.com/maps/place/${message.message.attachments[0].payload.coordinates.lat},${message.message.attachments[0].payload.coordinates.long}`;
        }
        if (type == "audio" && AUDIO_TYPE) {
          attachmentType == AUDIO_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "video" && VIDEO_TYPE) {
          attachmentType == VIDEO_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "image" && IMAGE_TYPE) {
          attachmentType == IMAGE_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "file" && FILE_TYPE) {
          attachmentType == FILE_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (!attachmentType) console.log("Attachment distinto:", type);
      }

      let user;

      try {
        user = await this.messenger.getUser(sender, [
          'first_name',
          'last_name'
        ])
      } catch (error) {
        if (showLogs) console.log("Error obteniendo user:", error);
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
    } else {
      reject("No coinciden los IDs")
    }
    });
    
  }

  sendMessage = async (message: any) => {
    if (message && message.type == "RESPONSE_MESSAGE") {
      if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
        switch (message.attachmentType) {
          case IMAGE_TYPE:
            this.sendImage(message.userKey, message.msj.attachmentUrl);
            break;
          case AUDIO_TYPE:
            this.sendAudio(message.userKey, message.msj.attachmentUrl);
            break;
          case VIDEO_TYPE:
            this.sendVideo(message.userKey, message.msj.attachmentUrl);
            break;
          case FILE_TYPE:
            this.sendVideo(message.userKey, message.msj.attachmentUrl);
            break;
        }
      } else {
        this.sendText(message.userKey, message.msj.mensajeTexto)
      }
    }
  }

  sendText = async (userId: string, text: string) => {
    this.messenger.send(new Text(text), userId);
  }

  sendAudio = async (userId: string, url: string) => {
    this.messenger.send(new Audio({
      url,
    }), userId);
  }

  sendImage = async (userId: string, url: string) => {
    this.messenger.send(new Image({
      url,
    }), userId);
  }

  sendVideo = async (userId: string, url: string) => {
    this.messenger.send(new Video({
      url,
    }), userId);
  }

  sendFile = async (userId: string, url: string) => {
    this.messenger.send(new File({
      url,
    }), userId);
  }


}
