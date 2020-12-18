require('dotenv').config()

import { EventEmitter } from "events";
import { LocalStorage } from "node-localstorage";
const { sleep } = require('@mtproto/core/src/utils/common');

const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts'); 
const Client = require('ftp');
const fs = require('fs');

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";
const FILE_TYPE = "file";
const GEO_TYPE = "geo";
const CONTACT_TYPE = null;

const showLogs = true;

export default class Telegram extends EventEmitter {

  mtproto: typeof MTProto;
  apiId: string;
  apiHash: string;
  phone: string;
  appKey: string

  constructor(appKey: string, phone: string, apiId: string, apiHash: string) {
    super();
    this.appKey = appKey;
    this.phone = phone.replace("+", "");;
    this.apiId = apiId;
    this.apiHash = apiHash;
    this.mtproto = new MTProto({
      api_id: this.apiId,
      api_hash: this.apiHash,
      customLocalStorage: new LocalStorage(`./tg/${phone}`)
    });
  }

  init = () => {
    return new Promise(async (resolve, reject) => {
      try {
        let result = await this.mtproto.call('users.getFullUser', {
          id: {
            _: 'inputUserSelf',
          },
        });

        if (result.user.phone != this.phone) {
          console.log("Numeros no coinciden", result.user.phone, this.phone)
          throw Error("Numeros no coinciden");
        } else {
          this.startListener();
          resolve(null);
        }
  
        
      } catch (error) {
        if (showLogs) console.log(`[Telegram - +${this.phone}] Debe iniciar sesión. Enviando código...`);
        try {
          let result: any = await this.sendCode(this.phone);
          const code = await this.getCode();
          
          await this.call('auth.signIn', {
            phone_code: code,
            phone_number: this.phone,
            phone_code_hash: result.phone_code_hash,
          });
          
          this.startListener();
          resolve(null);
        } catch (error) {
          if (error.error_message && error.error_message == "AUTH_RESTART") {
            if (showLogs) console.log(`[Telegram - +${this.phone}] Volviendo a enviar codigo...`);
          try {
            let result: any = await this.sendCode(this.phone);
            const code = await this.getCode();
            
            await this.call('auth.signIn', {
              phone_code: code,
              phone_number: this.phone,
              phone_code_hash: result.phone_code_hash,
            });
            this.startListener();
            resolve(null);
          } catch (error) {
            console.log(`Error:`, error);
          }
          }
        }
      }
    })
    
  }

  call = (method: string, params: object, options = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        let res = await this.mtproto.call(method, params, options);
        resolve(res);
      } catch (error) {
        console.log(`${method} error:`, error);

        const { error_code, error_message } = error;

        if (error_code === 420) {
          const seconds = +error_message.split('FLOOD_WAIT_')[1];
          const ms = seconds * 1000;

          console.log(`Se debe esperar ${seconds} segundos para esta consulta. Esperando...`)
  
          setTimeout(async () => {
            let res = await this.call(method, params, options);
            resolve(res);
          }, ms);
          
        }

        if (error_code === 303) {
          const [type, dcId] = error_message.split('_MIGRATE_');

          if (type === 'PHONE') {
            await this.mtproto.setDefaultDc(+dcId);
          } else {
            options = {
              ...options,
              dcId: +dcId,
            };
          }

          let res = this.call(method, params, options);
          resolve(res);
        }

        reject(error);
      }
    });
  }
  
  sendCode = (phone: string) => {
    return this.call('auth.sendCode', {
      phone_number: phone,
      settings: {
        _: 'codeSettings',
      },
    });
  }

  getCode = async () => {
    return (await prompts({
        type: 'text',
        name: 'code',
        message: `[Telegram - +${this.phone}] Ingresa el código enviado:`,
    })).code
  }

  getPassword = async () => {
    return (await prompts({
        type: 'text',
        name: 'password',
        message: `[Telegram - +${this.phone}] Ingresa la contraseña:`,
    })).password
  }

  startListener = () => {
    if (showLogs) console.log(`[Telegram - +${this.phone}] Sesión iniciada correctamente. Escuchando mensajes...`);

    this.mtproto.updates.on('updates', async (updateInstance: any) => {
      updateInstance.updates.map(async (update: any) => {
        if (update._ == "updateNewMessage" && update.message && !update.message.out) {
          let parsedMessage = await this.parseMessage(update.message);
          
          console.log(parsedMessage)
          this.emit("message", parsedMessage);
          
        }
        
      })
    });

    this.mtproto.updates.on('updateShortMessage', async (message: any) => {
      if (!message.out) {
        //if (showLogs) this.logMessage(message);
        let parsedMessage = await this.parseMessage(message);
        console.log(parsedMessage)
        this.emit("message", parsedMessage);
      }
      /* updateInstance.updates.map(async (update: any) => {
        console.log(update._);
        
      }) */
    });
  }

  logMessage = (data: any) => {
    
    if (data.media) {
      if (data.media._ == "messageMediaPhoto") {
        console.log(`[Telegram - @${this.phone}] recibió una imagen: ${data.media.photo.id}`);
      } else if (data.media._ == "messageMediaDocument") {
        if (data.media.document.mime_type.startsWith("video")) {
          console.log(`[Telegram - @${this.phone}] recibió un video: ${data.media.document.id}`);
        } else if (data.media.document.mime_type.startsWith("audio")) {
          console.log(`[Telegram - @${this.phone}] recibió un audio: ${data.media.document.id}`);
        } else if (data.media.document.mime_type.startsWith("application/x-tgsticker")) {
          console.log(`[Telegram - @${this.phone}] recibió un sticker: ${data.media.document.id}`);
        } else if (data.media.document.mime_type.startsWith("application")) {
          console.log(`[Telegram - @${this.phone}] recibió un archivo de tipo ${data.media.document.attributes[0].file_name}: ${data.media.document.id}`);
        } else {
          console.log(`[Telegram - @${this.phone}] recibió un media document no manejado: "${data.media.document.mime_type}"`);
          console.log(data);
        }
      } else if (data.media._ == "messageMediaGeo") {
        console.log(`[Telegram - @${this.phone}] recibió una ubicación: https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`);
        
      } else if (data.media._ == "messageMediaGeoLive") {
        console.log(`[Telegram - @${this.phone}] recibió una ubicación en tiempo real: https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`);
        
      } else if (data.media._ == "messageMediaContact") {
        console.log(`[Telegram - @${this.phone}] recibió un contacto: ${data.media.phone_number}`);
      } else {
        console.log(`[Telegram - @${this.phone}] recibió un media no manejado: "${data.media._}"`);
        console.log(data);
      }
      
    } else {
      console.log(`[Telegram - @${this.phone}] recibió: "${data.message}"`);
    }
    
  }

  uploadFile = (id: string, file: Buffer) => {
    return new Promise((resolve, reject) => {
      let c = new Client();
      console.log("uploadFile")
      c.on('ready', () => {
        console.log("ready")
        c.put(file, `${process.env.FTP_PATH}/${id}`, (err: any) => {
          console.log("put")
          if (err) reject(err);
          c.end();
          resolve(null)
        });
      });

      c.on('error', (err: any) => {
        console.log("error", err)
        
      });
      
      c.connect({
        host: process.env.FTP_HOST,
        port: process.env.FTP_PORT,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD
      });
    });
  }

  parseMessage = (data: any) => {
    return new Promise(async (resolve, reject) => {
      let attachmentType;
      let attachmentUrl;
      let userKey;

      if (data._ == "updateShortMessage") {
        userKey = data.user_id.toString();
      } else if (data._ == "message") {
        userKey = data.peer_id.user_id.toString();
        if (data.media) {
          

          if (data.media._ == "messageMediaPhoto" && IMAGE_TYPE) {
            attachmentType = IMAGE_TYPE;
            attachmentUrl = data.media.photo.id;
            try {
              this.uploadFile(data.media.photo.id, data.media.photo.file_reference);
            } catch (error) {
              console.log(error);
            }
          } else if (data.media._ == "messageMediaDocument") {
            if (data.media.document.mime_type.startsWith("image") && IMAGE_TYPE) {
              attachmentType = IMAGE_TYPE;
              attachmentUrl = data.media.document.id;
            } else if (data.media.document.mime_type.startsWith("video") && VIDEO_TYPE) {
              attachmentType = VIDEO_TYPE;
              attachmentUrl = data.media.document.id;
            } else if (data.media.document.mime_type.startsWith("audio") && AUDIO_TYPE) {
              attachmentType = AUDIO_TYPE;
              attachmentUrl = data.media.document.id;
            } else if (data.media.document.mime_type.startsWith("application/x-tgsticker") && IMAGE_TYPE) {
              attachmentType = IMAGE_TYPE;
              attachmentUrl = data.media.document.id;
            } else if (data.media.document.mime_type.startsWith("application") && FILE_TYPE) {
              attachmentType = FILE_TYPE;
              attachmentUrl = data.media.document.id;
            }
          } else if (data.media._ == "messageMediaGeo" && GEO_TYPE) {
            attachmentType = GEO_TYPE;
            attachmentUrl = `https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`;
          } else if (data.media._ == "messageMediaGeoLive" && GEO_TYPE) {
            attachmentType = GEO_TYPE;
            attachmentUrl = `https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`;
          } else if (data.media._ == "messageMediaContact" && CONTACT_TYPE) {
            attachmentType = CONTACT_TYPE;
            attachmentUrl = data.media.phone_number;
          }
        }
      }

      resolve({
        keyApp: this.appKey,
        userKey,
        msj: {
          userName: "",
          type: "PV",
          attachmentType,
          attachmentUrl,
          mensajeTexto: data.message,
        },
        type: "new_message"
      });
    })
  }

  sendMessage = async (message: any) => {
    return new Promise(async (resolve, reject) => {
      try {
        console.log("sendMessage", message)
        if (message && message.type == "RESPONSE_MESSAGE") {
        if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
          switch (message.msj.attachmentType) {
            case IMAGE_TYPE:
              await this.sendPhoto(message.msj.mensajeTexto, message.msj.attachmentUrl)
              break;
            case AUDIO_TYPE:
              await this.sendDocument(message.msj.mensajeTexto, message.msj.attachmentUrl)
              break;
            case VIDEO_TYPE:
              await this.sendDocument(message.msj.mensajeTexto, message.msj.attachmentUrl)
              break;
          }
        } else {
          await this.sendMessage(message.msj.mensajeTexto);
        }
      }
      
      } catch (error) {
        reject(error);
      }
      
    });
    
  }

  sendText = (userId: string, text: string) => {
    return new Promise(async (resolve, reject) => {
      let result = await this.call("messages.sendMessage", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: userId,
        },
        random_id: Math.floor(Math.random() * 1000000000)
      });
      resolve(result);
    });
  }

  sendPhoto = (text: string, url: string) => {
    return new Promise(async (resolve, reject) => {
      let result = await this.call("messages.sendMedia", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: 777000,
        },
        random_id: Math.floor(Math.random() * 1000000000),
        media: {
          _: "inputMediaPhotoExternal",
          url: url

        }
      });
      resolve(result);
    });
  }

  sendDocument = (text: string, url: string) => {
    return new Promise(async (resolve, reject) => {
      let result = await this.call("messages.sendMedia", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: 777000,
        },
        random_id: Math.floor(Math.random() * 1000000000),
        media: {
          _: "inputMediaDocumentExternal",
          url: url

        }
      });
      resolve(result);
    });
  }

 }

