
require('dotenv').config()

const EventEmitter = require('events');
const request = require('request');

import { promisify } from "util";
import { readFile } from "fs";
import {
    withRealtime,
    GraphQLSubscriptions,
    SkywalkerSubscriptions,
    IgApiClientRealtime,
    MessageSyncMessageWrapper
} from 'instagram_mqtt';
import { IgApiClient, DirectThreadEntity } from "instagram-private-api";
 
const readFileAsync = promisify(readFile);

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

const showLogs = true;

export default class Instagram extends EventEmitter {
  appKey: string;
  user: string;
  pass: string;
  ig: IgApiClientRealtime = withRealtime(new IgApiClient());

  constructor(appKey: string, user: string, pass: string) {
    super();
      this.appKey = appKey;
      this.user = user.replace("@", "");
      this.pass = pass;
    
  }
  
  init = async () => {
    try {
      await this.login();      

      await this.ig.realtime.connect({
        graphQlSubs: [
          GraphQLSubscriptions.getAppPresenceSubscription(),
          GraphQLSubscriptions.getDirectStatusSubscription(),
          GraphQLSubscriptions.getDirectTypingSubscription(this.ig.state.cookieUserId),
          GraphQLSubscriptions.getAsyncAdSubscription(this.ig.state.cookieUserId),
        ],
        skywalkerSubs: [
          SkywalkerSubscriptions.directSub(this.ig.state.cookieUserId),
          SkywalkerSubscriptions.liveSub(this.ig.state.cookieUserId)
        ],
        irisData: await this.ig.feed.directInbox().request(),
        connectOverrides: {},
      });
      this.startListener();
    } catch (error) {
      console.error(`[Instagram - @${this.user}]`, "ERROR:", error);
    }
  }

  login = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        if (showLogs) console.log(`[Instagram - @${this.user}] Iniciando sesión...`);
      
        if (this.user && this.pass) {
          this.ig.state.generateDevice(this.user);
          await this.ig.account.login(this.user, this.pass);
          resolve(null);
        } else {
          reject(new Error("Falta usuario o contraseña"));
        }
      } catch (error) {
        reject(error);
      }
      
    });
  }

  startListener = async () => {
    if (showLogs) console.log(`[Instagram - @${this.user}] Sesión iniciada correctamente. Escuchando mensajes...`);

    let userId = await this.ig.user.getIdByUsername(this.user);

      this.ig.realtime.on('receive', async (topic, messages) => {
        console.log('receive', topic, messages);
      });

      this.ig.realtime.on('direct', async (direct) => {
        console.log('direct', direct);
      });

      this.ig.realtime.on('message', async (data) => {
        let isSelfMessage = userId == data.message.user_id;
        if (!isSelfMessage) {
          if (data.message.op == 'add') {
            if (showLogs) this.logMessage(data);
            let parsedMessage = await this.parseMessage(data);
            
            this.emit('message', parsedMessage);
            //console.log(parsedMessage);
          } else {
            if (showLogs) console.log(`[Instagram - @${this.user}] DEBUG: La operacion era otra:`, data.message.op);
          }
        }
      });
  }

  

  logMessage = (data: MessageSyncMessageWrapper) => {
    if (data.message.item_type == "text") {
      console.log(`[Instagram - @${this.user}] recibió: "${data.message.text}"`);
    } else if (data.message.item_type == "media") {
      if (data.message.media?.media_type == 1) {
        console.log(`[Instagram - @${this.user}] recibió una imagen:`, data.message.media?.image_versions2?.candidates[0].url);
      } else { 
        console.log(`[Instagram - @${this.user}] recibió un video:`, data.message.media?.video_versions?.[0].url);
      }
    } else if (data.message.item_type == "voice_media") {
      console.log(`[Instagram - @${this.user}] recibió un mensaje de audio:`, data.message.voice_media?.media.audio.audio_src);
    } else if (data.message.item_type == "like") {
      console.log(`[Instagram - @${this.user}] recibió un like:`, '❤️');
    } else if (data.message.item_type == "animated_media") {
      console.log(`[Instagram - @${this.user}] recibió un GIF:`, data.message.animated_media?.images.fixed_height?.url);
    } else if (data.message.item_type == "raven_media") {
      if (data.message.visual_media?.media?.media_type == 1) {
        console.log(`[Instagram - @${this.user}] recibió una imagen efímera:`, data.message.visual_media?.media?.image_versions2?.candidates[0].url);
      } else { 
        console.log(`[Instagram - @${this.user}] recibió un video efímero:`, data.message.visual_media?.media?.video_versions?.[1].url);
      }
    } 
  }

  parseMessage = (data: MessageSyncMessageWrapper) => {
    return new Promise(async (resolve, reject) => {
      let mensajeTexto = "";
      let attachmentType;
      let attachmentUrl;
      let userInfo = await this.ig.user.info(data.message.user_id.toString());
      
      if (data.message.item_type == "text") {
        mensajeTexto = data.message.text ? data.message.text : "";
      } else if (data.message.item_type == "media") {
        if (data.message.media?.media_type == 1) {
          if (IMAGE_TYPE) { 
            attachmentType = IMAGE_TYPE;
            attachmentUrl = data.message.media?.image_versions2?.candidates[0].url;
          }
        } else {
          if (VIDEO_TYPE) { 
            attachmentType = VIDEO_TYPE;
            attachmentUrl = data.message.media?.video_versions?.[0].url;
          }
        }
      } else if (data.message.item_type == "voice_media" && AUDIO_TYPE) {
        attachmentType = AUDIO_TYPE;
        attachmentUrl = data.message.voice_media?.media.audio.audio_src;
      } else if (data.message.item_type == "like") {
        mensajeTexto = '❤️';
      } else if (data.message.item_type == "animated_media" && IMAGE_TYPE) {
        attachmentType = IMAGE_TYPE;
        attachmentUrl = data.message.animated_media?.images.fixed_height?.url;
      } else if (data.message.item_type == "raven_media") {
        if (data.message.visual_media?.media?.media_type == 1) {
          if (IMAGE_TYPE) { 
            attachmentType = IMAGE_TYPE;
            attachmentUrl = data.message.visual_media?.media?.image_versions2?.candidates[0].url;
          }
        } else { 
          if (VIDEO_TYPE) { 
            attachmentType = VIDEO_TYPE;
            attachmentUrl = data.message.visual_media?.media?.video_versions?.[1].url;
          }
        }
      }

      resolve({
        keyApp: this.appKey,
        userKey: data.message.thread_id,
        msj: {
          userName: userInfo.username,
          type: "PV",
          attachmentType,
          attachmentUrl,
          mensajeTexto,
        },
        type: "new_message"
      });
    })
  }

  sendMessage = async (message: any) => {
    let threads = await this.ig.feed.directInbox().records();
    let thread;

    for (const t of threads) {
      if (t.threadId == message.userKey) {
        thread = t;
      }
    }
    
    if (thread) {
      if (message && message.type == "RESPONSE_MESSAGE") {
        if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
          if (message.msj.attachmentType.startsWith(IMAGE_TYPE)) {
            this.sendImage(thread, message.msj.attachmentUrl);
          }
          if (message.msj.attachmentType.startsWith(AUDIO_TYPE)) {
            this.sendAudio(thread, message.msj.attachmentUrl);
          }
          if (message.msj.attachmentType.startsWith(VIDEO_TYPE)) {
            this.sendVideo(thread, message.msj.attachmentUrl);
          }
        }

        if (message.msj.mensajeTexto && message.msj.mensajeTexto != "") {
          this.sendText(thread, message.msj.mensajeTexto)
        }
      }
    }
  }

  getFile = (url: string) => {
    return new Promise<Buffer>((resolve, reject) => {
      request.get({url, encoding: null}, (err: any, res: any, body: Buffer) => {
        if (!err && res.statusCode == 200) {
            resolve(body);
        } else {
          reject(err);
        }
      });
    });
    
  }

  sendText = async (thread: DirectThreadEntity, text: string) => {
    await thread.broadcastText(text);
  }

  sendImage = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const image = await this.getFile(url);
        
        let result = await thread.broadcastPhoto({
          file: image,
        });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
  }

  sendAudio = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const audio = await this.getFile(url);
        let result = await thread.broadcastVoice({
          file: audio,
        });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
  }

  sendVideo = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const video = await this.getFile(url);
        let result = await thread.broadcastVideo({
          video: video,
          transcodeDelay: 5 * 1000,
        });
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    
  }

}

