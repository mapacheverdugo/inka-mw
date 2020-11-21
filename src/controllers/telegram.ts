const { MTProto, getSRPParams } = require('@mtproto/core');
const prompts = require('prompts');

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";
const FILE_TYPE = "file";
const GEO_TYPE = "geo";
const CONTACT_TYPE = null;

const showSelfMessages = true;
const showLogs = true;

export default class Telegram {

  mtproto: typeof MTProto;
  phone: string;

  constructor(phone: string) {
    this.phone = phone;
    this.mtproto = new MTProto({
      api_id: process.env.TELEGRAM_API_ID,
      api_hash: process.env.TELEGRAM_API_HASH
    });
  }

  init = async () => {
    try {
      await this.mtproto.call('users.getFullUser', {
        id: {
          _: 'inputUserSelf',
        },
      });

      this.startListener();
    } catch (error) {
      if (showLogs) console.log(`[Telegram - ${this.phone}] Debe iniciar sesión. Enviando código...`);
      try {
        let result: any = await this.sendCode(this.phone);
        const code = await this.getCode();
        
        await this.call('auth.signIn', {
          phone_code: code,
          phone_number: this.phone,
          phone_code_hash: result.phone_code_hash,
        });
        this.startListener();
      } catch (error) {
        console.log(`Error:`, error);
      }
    }
  }

  call = (method: string, params: object, options = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        let res = await this.mtproto.call(method, params, options);
        resolve(res);
      } catch (error) {
        console.log(`${method} error:`, error);

      const { error_code, error_message } = error;

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
        message: `[Telegram - ${this.phone}] Ingresa el código enviado:`,
    })).code
  }

  getPassword = async () => {
    return (await prompts({
        type: 'text',
        name: 'password',
        message: `[Telegram - ${this.phone}] Ingresa la contraseña:`,
    })).password
  }

  startListener = () => {
    if (showLogs) console.log(`[Telegram - ${this.phone}] Sesión iniciada correctamente. Escuchando mensajes...`);

    this.mtproto.updates.on('updates', (updateInstance: any) => {
      updateInstance.updates.map(async (update: any) => {
        if (update._ == "updateNewMessage") {
          if (showLogs) this.logMessage(update.message);
          let parsedMessage = await this.parseMessage(update.message);
          //console.log(parsedMessage);
        }
      })
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

  parseMessage = (data: any) => {
    return new Promise(async (resolve, reject) => {
      let attachmentType;
      let attachmentUrl;

      if (data.media) {
        if (data.media._ == "messageMediaPhoto" && IMAGE_TYPE) {
          attachmentType = IMAGE_TYPE;
          attachmentUrl = data.media.photo.id;
        } else if (data.media._ == "messageMediaDocument") {
          if (data.media.document.mime_type.startsWith("video") && VIDEO_TYPE) {
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

      resolve({
        keyApp: this.phone,
        userKey: data.from_id,
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

 }

