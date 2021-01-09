import {EventEmitter} from "events";

const { Messenger, Text, Audio, Video, Image, File } = require('fbmessenger');

import logger from "../common/logger";

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";
const FILE_TYPE = null;
const GEO_TYPE = null;

export default class FacebookPage extends EventEmitter {
  messenger: any;
  appKey: string;
  pageId: any;

  constructor(appKey: string, pageId: string, pageAccessToken: string | undefined) {
    super();
    this.appKey = appKey;
    this.messenger = new Messenger({
      pageAccessToken
    });
    this.pageId = pageId;
  }

  init = async () => {
    try {
      this.startListener();
    } catch (error) {
      logger.log({
        level: 'error',
        message: `Error al inicializar: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
  }

  handle = async (body: any) => {
    return this.messenger.handle(body);
  }

  startListener = () => {
    logger.log({
      level: 'info',
      message: `Acceso correcto. Escuchando mensajes...`,
      social: "Facebook",
      user: this.pageId
    });

    this.messenger.on('message', async (message: any) => {
      const recipient = message.recipient.id;

      try {
        if (this.pageId == recipient) {
          this.logMessage(message);
          let parsedMessage = await this.parseMessage(message);
          this.emit("message", parsedMessage);
        }
      } catch (error) {
        logger.log({
          level: 'error',
          message: `Error: ${error}`,
          social: "Facebook",
          user: this.pageId
        });
      }

      
    });
    
  }

  logMessage = (message: any) => {
    const recipient = message.recipient.id;

    if (this.pageId == recipient) {
      
    if ('attachments' in message.message) {
      const type = message.message.attachments[0].type;
      if (type == "location") {
        logger.log({
          level: 'info',
          message: `Se recibió una ubicación: https://www.google.com/maps/place/${message.message.attachments[0].payload.coordinates.lat},${message.message.attachments[0].payload.coordinates.long}`,
          social: "Facebook",
          user: this.pageId
        });
      } else if (type == "audio") {
        logger.log({
          level: 'info',
          message: `Se recibió un audio: ${message.message.attachments[0].payload.url}`,
          social: "Facebook",
          user: this.pageId
        });
      } else if (type == "video") {
        logger.log({
          level: 'info',
          message: `Se recibió un video: ${message.message.attachments[0].payload.url}`,
          social: "Facebook",
          user: this.pageId
        });
      } else if (type == "image") {
        logger.log({
          level: 'info',
          message: `Se recibió un imagen: ${message.message.attachments[0].payload.url}`,
          social: "Facebook",
          user: this.pageId
        });
      } else if (type == "file") {
        logger.log({
          level: 'info',
          message: `Se recibió un archivo: ${message.message.attachments[0].payload.url}`,
          social: "Facebook",
          user: this.pageId
        });
      } 
  
    } else if ('text' in message.message) {
      logger.log({
        level: 'info',
        message: `Se recibió: "${message.message.text}"`,
        social: "Facebook",
        user: this.pageId
      });
    }
  }
  }

  parseMessage = (message: any) => {
    return new Promise(async (resolve, reject) => {
      const recipient = message.recipient.id;
      const sender = message.sender.id;

      let attachmentType;
      let attachmentUrl;
      let mensajeTexto = "";

      if (this.pageId == recipient) {

      if ('text' in message.message) {
        mensajeTexto = message.message.text;
      }

      if ('attachments' in message.message) {
        const type = message.message.attachments[0].type;
        if (type == "location" && GEO_TYPE) {
          attachmentType = GEO_TYPE;
          attachmentUrl = `https://www.google.com/maps/place/${message.message.attachments[0].payload.coordinates.lat},${message.message.attachments[0].payload.coordinates.long}`;
        }
        if (type == "audio" && AUDIO_TYPE) {
          attachmentType = AUDIO_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "video" && VIDEO_TYPE) {
          attachmentType = VIDEO_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "image" && IMAGE_TYPE) {
          attachmentType = IMAGE_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (type == "file" && FILE_TYPE) {
          attachmentType = FILE_TYPE;
          attachmentUrl = message.message.attachments[0].payload.url;
        }
        if (!attachmentType) {
          logger.log({
            level: 'silly',
            message: `Se recibió attachmentType distinto: ${type}`,
            social: "Facebook",
            user: this.pageId
          });
        }
      }

      let user;

      try {
        user = await this.messenger.getUser(sender, [
          'first_name',
          'last_name'
        ])
      } catch (error) {
        logger.log({
          level: 'error',
          message: `Error obteniendo el usuario: ${error}`,
          social: "Facebook",
          user: this.pageId
        });
      }


      resolve({
        keyApp: this.appKey,
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
        if (message.msj.attachmentType.startsWith(IMAGE_TYPE)) {
          this.sendImage(message.userKey, message.msj.attachmentUrl);
        } else if (message.msj.attachmentType.startsWith(AUDIO_TYPE)) {
          this.sendAudio(message.userKey, message.msj.attachmentUrl);
        } else if (message.msj.attachmentType.startsWith(VIDEO_TYPE)) {
          this.sendVideo(message.userKey, message.msj.attachmentUrl);
        } else {
          this.sendFile(message.userKey, message.msj.attachmentUrl);
        }
        
      }
      
      if (message.msj.mensajeTexto && message.msj.mensajeTexto != "") {
        this.sendText(message.userKey, message.msj.mensajeTexto)
      }
    }
  }

  sendText = async (userId: string, text: string) => {
    try {
      this.messenger.send(new Text(text), userId);
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar texto: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
    
  }

  sendAudio = async (userId: string, url: string) => {
    try {
      this.messenger.send(new Audio({
        url,
      }), userId);
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar audio: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
  }

  sendImage = async (userId: string, url: string) => {
    try {
      this.messenger.send(new Image({
        url,
      }), userId);
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar imagen: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
    
  }

  sendVideo = async (userId: string, url: string) => {
    try {
      this.messenger.send(new Video({
        url,
      }), userId);
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar video: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
  }

  sendFile = async (userId: string, url: string) => {
    try {
      this.messenger.send(new File({
        url,
      }), userId);
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar archivo: ${error}`,
        social: "Facebook",
        user: this.pageId
      });
    }
  }
}
