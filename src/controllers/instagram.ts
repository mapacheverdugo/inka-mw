
require('dotenv').config()

const EventEmitter = require('events');

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
  user: string;
  pass: string;
  ig: IgApiClientRealtime = withRealtime(new IgApiClient());

  constructor(user: string | undefined, pass: string | undefined) {
    super();
    if (user && pass) {
      this.user = user;
      this.pass = pass;
    } else { 
      throw new Error("Debe ingresar un usuario y una contraseña");
    }
  }
  
  init = async () => {
    try {
      await this.login();      

      await this.ig.realtime.connect({
        graphQlSubs: [
          GraphQLSubscriptions.getAppPresenceSubscription(),
          GraphQLSubscriptions.getZeroProvisionSubscription(this.ig.state.phoneId),
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
      console.error("Error:", error);
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
        reject("Falta usuario o contraseña");
        }
      } catch (error) {
        reject(error);
      }
      
    });
  }

  startListener = async () => {
    if (showLogs) console.log(`[Instagram - @${this.user}] Sesión iniciada correctamente. Escuchando mensajes...`);

    let userId = await this.ig.user.getIdByUsername(this.user);

      this.ig.realtime.on('message', async (data) => {
        let isSelfMessage = userId == data.message.user_id;
        if (!isSelfMessage) {
          if (data.message.op == 'add') {
            if (showLogs) this.logMessage(data);
            let parsedMessage = await this.parseMessage(data);
            this.emit('message', parsedMessage);
            //console.log(parsedMessage);
          } else {
            if (showLogs) console.log('La operacion era otra', data.message.op);
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
      let mensajeTexto;
      let attachmentType;
      let attachmentUrl;
      let userInfo = await this.ig.user.info(data.message.user_id.toString());
      
      if (data.message.item_type == "text") {
        mensajeTexto = data.message.text;
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
        keyApp: this.user,
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

    if (thread && message && message.type == "RESPONSE_MESSAGE") {
      if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
        switch (message.attachmentType) {
          case IMAGE_TYPE:
            this.sendImage(thread, message.msj.attachmentUrl);
            break;
          case AUDIO_TYPE:
            this.sendAudio(thread, message.msj.attachmentUrl);
            break;
          case VIDEO_TYPE:
            this.sendVideo(thread, message.msj.attachmentUrl);
            break;
        }
      } else {
        this.sendText(thread, message.msj.mensajeTexto)
      }
    }
  }

  sendText = async (thread: DirectThreadEntity, text: string) => {
    await thread.broadcastText(text);
  }

  sendAudio = async (thread: DirectThreadEntity, url: string) => {
    const audio = await readFileAsync(url);
    console.log(await thread.broadcastVoice({
        file: audio,
    }));
  }

  sendImage = async (thread: DirectThreadEntity, url: string) => {
    const image = await readFileAsync(url);
    console.log(await thread.broadcastPhoto({
        file: image,
    }));
  }

  sendVideo = async (thread: DirectThreadEntity, url: string) => {
    const video = await readFileAsync(url);
    console.log(await thread.broadcastVideo({
        video,
        transcodeDelay: 5 * 1000,
    }));
  }
}

