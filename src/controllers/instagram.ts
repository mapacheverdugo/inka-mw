
require('dotenv').config()

const EventEmitter = require('events');
const request = require('request');

import { promisify } from "util";
import { readFile } from "fs";
import {
    withFbnsAndRealtime,
    GraphQLSubscriptions,
    SkywalkerSubscriptions,
    MessageSyncMessage,
    IgApiClientMQTT
} from 'instagram_mqtt';
import { IgApiClient, DirectThreadEntity, DirectInboxFeedResponseItemsItem } from "instagram-private-api";
 
const readFileAsync = promisify(readFile);

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

const showLogs = true;

export default class Instagram extends EventEmitter {
  appKey: string;
  user: string;
  pass: string;
  ig: IgApiClientMQTT = withFbnsAndRealtime(new IgApiClient());

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
      this.startListenAndAprovePendings();
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

  startListenAndAprovePendings = () => {
    let secs = process.env.INSTAGRAM_SEC_INTERVAL ? parseInt(process.env.INSTAGRAM_SEC_INTERVAL) : 30
    let interval = secs * 1000;

    setInterval(async () => {
      //if (showLogs) console.log(`[Instagram - @${this.user}] Obteniendo solicitudes de mensaje...`);

      const pendings = await this.ig.feed.directPending().items();

      if (pendings.length > 0) {
        if (showLogs) console.log(`[Instagram - @${this.user}] Se encontraron ${pendings.length} solicitudes de mensajes que se aprobaran.`);
      }

      for (const pending of pendings) {
        await this.ig.directThread.approve(pending.thread_id);

        for (const item of pending.items) {
          if (showLogs) this.logMessage(item);
          let parsedMessage = await this.parseMessage(item, pending.thread_id)
          this.emit('message', parsedMessage);
        }
      }
    }, interval);
  }

  startListener = async () => {
    if (showLogs) console.log(`[Instagram - @${this.user}] Sesión iniciada correctamente. Escuchando mensajes...`);

    let userId = await this.ig.user.getIdByUsername(this.user);

    this.ig.realtime.on('message', async (data) => {
      let isSelfMessage = userId == data.message.user_id;
      if (!isSelfMessage) {
        if (data.message.op == 'add') {
          if (showLogs) this.logMessage(data.message);
          console.log(data.message);
          let parsedMessage = await this.parseMessage(data.message);
          this.emit('message', parsedMessage);
        }
      }
    });
  }

  

  logMessage = (message: any) => {
    if (message.item_type == "text") {
      console.log(`[Instagram - @${this.user}] recibió: "${message.text}"`);
    } else if (message.item_type == "media") {
      if (message.media?.media_type == 1) {
        console.log(`[Instagram - @${this.user}] recibió una imagen:`, message.media?.image_versions2?.candidates[0].url);
      } else { 
        console.log(`[Instagram - @${this.user}] recibió un video:`, message.media?.video_versions?.[0].url);
      }
    } else if (message.item_type == "voice_media") {
      console.log(`[Instagram - @${this.user}] recibió un mensaje de audio:`, message.voice_media?.media.audio.audio_src);
    } else if (message.item_type == "like") {
      console.log(`[Instagram - @${this.user}] recibió un like:`, '❤️');
    } else if (message.item_type == "animated_media") {
      console.log(`[Instagram - @${this.user}] recibió un GIF:`, message.animated_media?.images.fixed_height?.url);
    } else if (message.item_type == "raven_media") {
      if (message.visual_media?.media?.media_type == 1) {
        console.log(`[Instagram - @${this.user}] recibió una imagen efímera:`, message.visual_media?.media?.image_versions2?.candidates[0].url);
      } else { 
        console.log(`[Instagram - @${this.user}] recibió un video efímero:`, message.visual_media?.media?.video_versions?.[1].url);
      }
    } 
  }

  parseMessage = (message: any, threadId?: any) => {
    return new Promise(async (resolve, reject) => {
      let mensajeTexto = "";
      let attachmentType = "";
      let attachmentUrl = "";
      let userName = "";
      let userKey = threadId ? threadId : message.thread_id;

      try {
        let userInfo = await this.ig.user.info(message.user_id.toString());
        if (userInfo.username && userInfo.username != "") {
          userName = userInfo.username;
        }
      } catch (error) {
        console.log(`[Instagram - @${this.user}] ERROR:`, error);
        userName = message.user_id.toString();
      }

      
      if (message.item_type == "text") {
        mensajeTexto = message.text ? message.text : "";
      } else if (message.item_type == "media") {
        if (message.media?.media_type == 1) {
          if (IMAGE_TYPE) { 
            attachmentType = IMAGE_TYPE;
            attachmentUrl = message.media?.image_versions2?.candidates[0].url || "";
          }
        } else {
          if (VIDEO_TYPE) { 
            attachmentType = VIDEO_TYPE;
            attachmentUrl = message.media?.video_versions?.[0].url || "";
          }
        }
      } else if (message.item_type == "voice_media" && AUDIO_TYPE) {
        attachmentType = AUDIO_TYPE;
        attachmentUrl = message.voice_media?.media.audio.audio_src || "";
      } else if (message.item_type == "like") {
        mensajeTexto = '❤️';
      } else if (message.item_type == "animated_media" && IMAGE_TYPE) {
        attachmentType = IMAGE_TYPE;
        attachmentUrl = message.animated_media?.images.fixed_height?.url || "";
      } else if (message.item_type == "raven_media") {
        if (message.visual_media?.media?.media_type == 1) {
          if (IMAGE_TYPE) { 
            attachmentType = IMAGE_TYPE;
            attachmentUrl = message.visual_media?.media?.image_versions2?.candidates[0].url || "";
          }
        } else { 
          if (VIDEO_TYPE) { 
            attachmentType = VIDEO_TYPE;
            attachmentUrl = message.visual_media?.media?.video_versions?.[1].url || "";
          }
        }
      }

      resolve({
        keyApp: this.appKey,
        userKey,
        msj: {
          userName,
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

