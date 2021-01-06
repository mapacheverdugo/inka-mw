require('dotenv').config()

import { EventEmitter } from "events";
import { LocalStorage } from "node-localstorage";
import { LocalFileSystem, SftpFileSystem, FtpFileSystem } from "ftp-sftp";
import { Readable } from "stream";
const toReadableStream = require('to-readable-stream');

const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts'); 
const Client = require('ssh2-sftp-client');
const fs = require('fs'); 

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";
const FILE_TYPE = null;
const GEO_TYPE = null;
const CONTACT_TYPE = null;

const showLogs = true;


export default class Telegram extends EventEmitter {
  mtproto: typeof MTProto;
  apiId: string;
  apiHash: string;
  phone: string;
  appKey: string;
  accessHash: string | undefined;

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
        let userFull = await this.mtproto.call('users.getFullUser', {
          id: {
            _: 'inputUserSelf',
          },
        });

        this.accessHash = userFull.user.access_hash;

        if (userFull.user.phone != this.phone) {
          console.log("Numeros no coinciden", userFull.user.phone, this.phone)
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

  startListener = () => {
    if (showLogs) console.log(`[Telegram - +${this.phone}] Sesión iniciada correctamente. Escuchando mensajes...`);

    /* this.mtproto.updates.on('updates', async (updateInstance: any) => {
      updateInstance.updates.map(async (update: any) => {
        if (update._ == "updateNewMessage" && update.message && !update.message.out) {
          console.log(update);
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
        console.log(message)
        this.emit("message", parsedMessage);
      }
    }); */

    

    /* this.mtproto.updates.on('updateShort', async (data: any) => {
      console.log("updateShort", data)
    }) */

    this.mtproto.updates.on('updateShortMessage', async (data: any) => {
      console.log("updateShortMessage", data)
      console.log("accessHash", this.accessHash)
      let result = await this.call("users.getFullUser", {
        id: {
          _: "inputUserFromMessage",
          peer: {
            _: "inputPeerUser",
            user_id: data.user_id,
            access_hash: this.accessHash
          },
          msg_id: data.id,
          user_id: data.user_id,
        },
      });
      console.log("messages.getAllChats", result)
    })

    
    /* this.mtproto.updates.on('updateShortChatMessage', async (data: any) => {
      console.log("updateShortChatMessage", data)
    })

    this.mtproto.updates.on('updatesCombined', async (data: any) => {
      console.log("updatesCombined", data)
    })

    this.mtproto.updates.on('updatesTooLong', async (data: any) => {
      console.log("updatesTooLong", data)
    })

    this.mtproto.updates.on('updates', async (data: any) => {
      console.log("updates", data)
    }) */

    
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

  uploadFile = (fileName: string, file: Uint8Array) => {
    return new Promise<string>(async (resolve, reject) => {
      try {
        let remoteFs;
        let localFs = new LocalFileSystem();

        fs.appendFile("../temp", Buffer.from(file), (err: any) => {
          if (err) {
            console.log(err);
          } else {
            console.log("todo bien")
          }
        });
      
        if (process.env.FTP_HOST && process.env.FTP_PORT && process.env.FTP_USER && process.env.FTP_PASSWORD) {
          if (process.env.FTP_TYPE && process.env.FTP_TYPE == "sftp") {
            remoteFs = await SftpFileSystem.create(process.env.FTP_HOST, parseInt(process.env.FTP_PORT), process.env.FTP_USER, process.env.FTP_PASSWORD);
          } else {
            remoteFs = await FtpFileSystem.create(process.env.FTP_HOST, parseInt(process.env.FTP_PORT), process.env.FTP_USER, process.env.FTP_PASSWORD);
          }

          let result = await remoteFs.put(toReadableStream(file), `${process.env.FTP_PATH}/${fileName}`);
          resolve(process.env.FTP_URL + "/" + fileName);
        } else {
          reject(new Error("No hay servidor FTP/SFTP configurado"));
        }
      } catch (error) {
        reject(error);
      }
      
    });
  }

  parseMessage = (data: any) => {
    return new Promise(async (resolve, reject) => {
      let attachmentType = "";
      let attachmentUrl = "";
      let userKey = "";
      let userName = "";


      if (data._ == "updateShortMessage") {
        userKey = data.user_id.toString();
      } else if (data._ == "message") {
        userKey = data.peer_id.user_id.toString();
        if (data.media) {
          if (data.media._ == "messageMediaPhoto" && IMAGE_TYPE) {
            attachmentType = IMAGE_TYPE;
            try {
              attachmentUrl = await this.uploadFile(`${data.media.photo.id}.jpg`, data.media.photo.file_reference);
            } catch (error) {
              console.log(error);
            }
          } else if (data.media._ == "messageMediaDocument") {
            if (data.media.document.mime_type.startsWith("image") && IMAGE_TYPE) {
              attachmentType = IMAGE_TYPE;
              try {
                attachmentUrl = await this.uploadFile(`${data.media.photo.id}.${data.media.document.mime_type.replace("image/")}`, data.media.photo.file_reference);
              } catch (error) {
                console.log(error);
              }
            } else if (data.media.document.mime_type.startsWith("video") && VIDEO_TYPE) {
              attachmentType = VIDEO_TYPE;
              try {
                attachmentUrl = await this.uploadFile(`${data.media.document.id}.${data.media.document.mime_type.replace("video/")}`, data.media.photo.file_reference);
              } catch (error) {
                console.log(error);
              }
            } else if (data.media.document.mime_type.startsWith("audio") && AUDIO_TYPE) {
              attachmentType = AUDIO_TYPE;
              try {
                attachmentUrl = await this.uploadFile(`${data.media.document.id}.${data.media.document.mime_type.replace("audio/")}`, data.media.photo.file_reference);
              } catch (error) {
                console.log(error);
              }
            } else if (data.media.document.mime_type.startsWith("application/x-tgsticker") && IMAGE_TYPE) {
              attachmentType = IMAGE_TYPE;
              try {
                attachmentUrl = await this.uploadFile(`${data.media.document.id}.gif`, data.media.photo.file_reference);
              } catch (error) {
                console.log(error);
              }
            } else if (data.media.document.mime_type.startsWith("application") && FILE_TYPE) {
              attachmentType = FILE_TYPE || "";
              attachmentUrl = data.media.document.id;
            }
          } else if (data.media._ == "messageMediaGeo" && GEO_TYPE) {
            attachmentType = GEO_TYPE || "";
            attachmentUrl = `https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`;
          } else if (data.media._ == "messageMediaGeoLive" && GEO_TYPE) {
            attachmentType = GEO_TYPE || "";
            attachmentUrl = `https://www.google.com/maps/place/${data.media.geo.lat},${data.media.geo.long}`;
          } else if (data.media._ == "messageMediaContact" && CONTACT_TYPE) {
            attachmentType = CONTACT_TYPE || "";
            attachmentUrl = data.media.phone_number;
          }
        }
      }

      try {
        let result: any = await this.call('users.getFullUser', {
          id: {
            _: "inputUserFromMessage",
            peer: {
              _: "inputPeerUserFromMessage",
              msg_id: data.id,
              user_id: userKey,
            },
            msg_id: data.id,
            user_id: userKey,
          },
        });

        const user = result.user;

        console.log("user", user);

        if (user.first_name && user.first_name != "") {
          userName += user.first_name;
          if (user.last_name && user.last_name != "") {
            userName += " "
          }
        }
        if (user.last_name && user.last_name != "") {
          userName += user.last_name;
        }

        if (!userName || userName == "") {
          if (user.phone && user.phone != "") {

            userName = user.phone;
          } else {
            userName = userKey;
          }
        }

        console.log(userName)
      } catch (error) {
        console.error(`[Telegram - +${this.phone}] ERROR:`, error)

        try {
          let result2: any = await this.call('contacts.addContact', {
            id: {
              _: "inputUserFromMessage",
              flags: "min",
              peer: {
                _: "inputPeerUser",
                user_id: userKey,
              },
              msg_id: data.id,
              user_id: userKey,
            },
            first_name: "Desde",
            last_name: "Node"
          });

          let result: any = await this.call('users.getFullUser', {
            id: {
              _: "inputUser",
              user_id: userKey
            },
          });
  
          const user = result.user;
  
          console.log("user", user);
        } catch (e) {
          console.log("ERROR contacts.acceptContact", e)
        }
        userName = userKey;
      }

      resolve({
        keyApp: this.appKey,
        userKey,
        msj: {
          userName,
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
        if (message && message.type == "RESPONSE_MESSAGE") {
        if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
          if (message.msj.attachmentType.startsWith(IMAGE_TYPE)) {
            this.sendPhoto(message.userKey, message.msj.mensajeTexto, message.msj.attachmentUrl);
          }
          if (message.msj.attachmentType.startsWith(AUDIO_TYPE)) {
            this.sendDocument(message.userKey, message.msj.mensajeTexto, message.msj.attachmentUrl);
          }
          if (message.msj.attachmentType.startsWith(VIDEO_TYPE)) {
            this.sendDocument(message.userKey, message.msj.mensajeTexto, message.msj.attachmentUrl);
          }
        } else {
          await this.sendText(message.userKey, message.msj.mensajeTexto);
        }
      }
      
      } catch (error) {
        reject(error);
      }
      
    });
    
  }

  sendText = (userId: string, text: string) => {
    return new Promise(async (resolve, reject) => {
      let newUserId = parseInt(userId);
      let result = await this.call("messages.sendMessage", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: newUserId,
        },
        random_id: Math.floor(Math.random() * 1000000000)
      });
      resolve(result);
    });
  }

  sendPhoto = (userId: string, text: string, url: string) => {
    return new Promise(async (resolve, reject) => {
      let newUserId = parseInt(userId);
      let result = await this.call("messages.sendMedia", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: newUserId,
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

  sendDocument = (userId: string, text: string, url: string) => {
    return new Promise(async (resolve, reject) => {
      let newUserId = parseInt(userId);
      let result = await this.call("messages.sendMedia", {
        message: text,
        peer: {
          _: "inputPeerUser",
          user_id: newUserId,
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

