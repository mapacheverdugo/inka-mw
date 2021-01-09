
require('dotenv').config()

import fetch from "node-fetch";
import { EventEmitter } from "events";
import sharp from "sharp";
import tmp from "tmp";
import ffmpeg from "fluent-ffmpeg";
import oldFfmpeg from "ffmpeg";
import { readFile, appendFile, unlinkSync } from "fs";
import {
    withFbnsAndRealtime,
    GraphQLSubscriptions,
    SkywalkerSubscriptions,
    MessageSyncMessage,
    IgApiClientMQTT
} from 'instagram_mqtt';
import { IgApiClient, DirectThreadEntity, DirectInboxFeedResponseItemsItem } from "instagram-private-api";

import logger from "../common/logger";

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

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
      logger.log({
        level: 'error',
        message: `Error al inicializar: ${error}`,
        social: "Instagram",
        user: `@${this.user}`
      });
    }
  }

  login = async () => {
    return new Promise(async (resolve, reject) => {
      try {
        logger.log({
          level: 'info',
          message: `Iniciando sesión...`,
          social: "Instagram",
          user: `@${this.user}`
        });
      
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
      //if (showLogs) console.log(`Obteniendo solicitudes de mensaje...`);
      try {
          const pendings = await this.ig.feed.directPending().items();

          if (pendings.length > 0) {
            logger.log({
              level: 'info',
              message: `Se encontraron ${pendings.length} solicitudes de mensajes que se aprobaran.`,
              social: "Instagram",
              user: `@${this.user}`
            });
          }

          for (const pending of pendings) {
            await this.ig.directThread.approve(pending.thread_id);

            for (const item of pending.items) {
              this.logMessage(item);
              let parsedMessage = await this.parseMessage(item, pending.thread_id)
              this.emit('message', parsedMessage);
            }
          }
        
      } catch (error) {
        logger.log({
          level: 'warn',
          message: `No se puedieron obtener los pendientes`,
          social: "Instagram",
          user: `@${this.user}`
        });
      }
    }, interval);
  }

  startListener = async () => {
    logger.log({
      level: 'info',
      message: `Sesión iniciada correctamente. Escuchando mensajes...`,
      social: "Instagram",
      user: `@${this.user}`
    });

    try {
      let userId = await this.ig.user.getIdByUsername(this.user);

      this.ig.realtime.on('message', async (data) => {
        try {
          let isSelfMessage = userId == data.message.user_id;
          if (!isSelfMessage) {
            if (data.message.op == 'add') {
              this.logMessage(data.message);
              let parsedMessage = await this.parseMessage(data.message);
              this.emit('message', parsedMessage);
            }
          }
        } catch (error) {
          logger.log({
            level: 'error',
            message: `Error: ${error}`,
            social: "Instagram",
            user: `@${this.user}`
          });
        }
        
      });
    } catch (error) {
      logger.log({
        level: 'warn',
        message: `No se pudo obtener el nombre de usuario`,
        social: "Instagram",
        user: `@${this.user}`
      });
    }
  }

  

  logMessage = (message: any) => {
    if (message.item_type == "text") {
      logger.log({
        level: 'info',
        message: `Se recibió: "${message.text}"`,
        social: "Instagram",
        user: `@${this.user}`
      });
    } else if (message.item_type == "media") {
      if (message.media?.media_type == 1) {
        logger.log({
          level: 'info',
          message: `Se recibió una imagen: ${message.media?.image_versions2?.candidates[0].url}`,
          social: "Instagram",
          user: `@${this.user}`
        });
      } else {
        logger.log({
          level: 'info',
          message: `Se recibió un video: ${message.media?.video_versions?.[0].url}`,
          social: "Instagram",
        user: `@${this.user}`
        });
      }
    } else if (message.item_type == "voice_media") {
      logger.log({
        level: 'info',
        message: `Se recibió un mensaje de audio: ${message.voice_media?.media.audio.audio_src}`,
        social: "Instagram",
        user: `@${this.user}`
      });
    } else if (message.item_type == "like") {
      logger.log({
        level: 'info',
        message: `Se recibió un like: "❤️"`,
        social: "Instagram",
        user: `@${this.user}`
      });
    } else if (message.item_type == "animated_media") {
      logger.log({
        level: 'info',
        message: `Se recibió un GIF: ${message.animated_media?.images.fixed_height?.url}`,
        social: "Instagram",
        user: `@${this.user}`
      });
    } else if (message.item_type == "raven_media") {
      if (message.visual_media?.media?.media_type == 1) {
        logger.log({
          level: 'info',
          message: `Se recibió una imagen efímera: ${message.visual_media?.media?.image_versions2?.candidates[0].url}`,
          social: "Instagram",
          user: `@${this.user}`
        });
      } else {
        logger.log({
          level: 'info',
          message: `Se recibió un video efímero: ${message.visual_media?.media?.video_versions?.[1].url}`,
          social: "Instagram",
          user: `@${this.user}`
        });
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
        logger.log({
          level: 'error',
          message: `No se pudo obtener el nombre de usuario: ${error}`,
          social: "Instagram",
          user: `@${this.user}`
        });
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

      if (attachmentType != "" || attachmentUrl != "" || mensajeTexto != "") {
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
      } else {
        resolve({
          keyApp: this.appKey,
          userKey,
          msj: {
            userName,
            type: "PV",
            attachmentType,
            attachmentUrl,
            mensajeTexto: "",
          },
          type: "new_message"
        });
      }
    })
  }

  sendMessage = async (message: any) => {
    try {
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
            logger.log({
              level: 'debug',
              message: `Se recibio adjunto de typo ${message.msj.attachmentType}`,
              social: "Instagram",
              user: `@${this.user}`

            });
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
    } catch (error) {
      logger.log({
        level: 'error',
        message: `No se pudo enviar mensaje. Si viene con adjunto archivo puede estar dañado. Error: ${error}`,
        social: "Instagram",
        user: `@${this.user}`
      });
    }
    
  }

  sendText = async (thread: DirectThreadEntity, text: string) => {
    await thread.broadcastText(text);
  }

  sendImage = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const image = await fetch(url);
        const imageBuffer = await image.buffer();
        const sharpImage = sharp(imageBuffer);
        const imageMetadata = await sharpImage.metadata()
        let finalImageBuffer;

        let width = imageMetadata.width;
        let height = imageMetadata.height;
        if (width && height) {
          let aspect = width / height;
          
          let newSize = {width, height};
          let newAspect = aspect;

          if (width > 1080 || height > 1350 || aspect > 1.9 || aspect < 0.8) {
            if (aspect > 1.9) {
              if (width > 1080) {
                newAspect = 1.9;
                newSize = {width: 1080, height: width / newAspect};
              } else {
                newAspect = 1.9;
                newSize = {width, height: width / newAspect};
              }
            } else if (aspect < 0.8) {
              if (height > 1350) {
                newAspect = 0.8;
                newSize = {height: 1350, width: height * newAspect};
              } else {
                newAspect = 0.8;
                newSize = {height, width: height * newAspect};
              }
            } else {
              if (aspect > 1) {
                if (width > 1080) {
                  newSize = {width: 1080, height: width / newAspect};
                }
              } else if (aspect <= 1) {
                if (height > 1350) {
                  newSize = {height: 1350, width: height * newAspect};
                }
              }
            }
            
          }
        

          finalImageBuffer = await sharpImage.resize({...newSize, ...{fit: "fill"}}).toFormat('jpeg').toBuffer();
        } else {
          finalImageBuffer = imageBuffer;
        }

        let result = await thread.broadcastPhoto({
          file: finalImageBuffer,
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
        const audio = await fetch(url);
        const audioBuffer = await audio.buffer();
        tmp.file((err: any, path: any, fd: any, cleanup: any) => {
          if (err) reject(err);
      
          appendFile(path, audioBuffer, () => {
            let tempFilePath = "temp/" + new Date().getTime() + ".mp4";

            new oldFfmpeg(path, async (err: any, audio: any) => {
              if (!err) {
                let duration = audio.metadata.duration.seconds;
                let newDuration = duration;

                let command = ffmpeg(path).format('mp4');

                if (duration > 60) {
                  newDuration = 60;
                }

                logger.log({
                  level: 'debug',
                  message: `El audio original tiene una duración de ${newDuration} segundos`,
                  social: "Instagram",
                  user: `@${this.user}`
                });
                
                command.on('error', (err: any) => {
                  logger.log({
                    level: 'error',
                    message: `Error en FFMPEG al procesar el audio: ${err}`
                  });
                  reject(err);
                });

                command.on('end', () => {
                  readFile(tempFilePath, async (err: any, data: Buffer) => {
                    try {
                      unlinkSync(tempFilePath);
                    } catch (error) {
                      
                    } finally {
                      tmp.setGracefulCleanup();
                      if (err) reject(err);
                      let result = await thread.broadcastVoice({
                        file: data,
                      });
                      resolve(result);
                    }
                  });
                });

                command.noVideo().duration(newDuration).save(tempFilePath); 
              } else {
                reject(err)
              }
            });
          });
        });

        

        
      } catch (error) {
        reject(error);
      }
    });
    
  }

  sendVideo = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const video = await fetch(url);
        const videoBuffer = await video.buffer();
        tmp.file((err: any, path: any, fd: any, cleanup: any) => {
          if (err) reject(err);
      
          appendFile(path, videoBuffer, () => {
            let tempFilePath = "temp/" + new Date().getTime() + ".mp4";

            new oldFfmpeg(path, async (err: any, video: any) => {
              if (!err) {
                let duration = video.metadata.duration.seconds;
                let width = video.metadata.video.resolution.w;
                let height = video.metadata.video.resolution.h;
                let aspect = video.metadata.video.aspect.value;
                let fps = video.metadata.video.fps;
                
                let newSize = `${width}x${height}`;
                let newAspect = aspect;
                let newDuration = duration;
                let newFps = fps;

                let command = ffmpeg(path).format('mp4');

                if (width > 1080 || height > 1350 || aspect > 1.9 || aspect < 0.8) {
                  if (aspect > 1.9) {
                    if (width > 1080) {
                      newSize = '1080x?';
                      newAspect = 1.9;
                    } else {
                      newAspect = 1.9;
                    }
                  } else if (aspect < 0.8) {
                    if (height > 1350) {
                      newSize = '?x1350';
                      newAspect = 0.8;
                    } else {
                      newAspect = 0.8;
                    }
                  } else {
                    if (aspect > 1) {
                      if (width > 1080) {
                        newSize = '1080x?';
                      }
                    } else if (aspect <= 1) {
                      if (height > 1350) {
                        newSize = '?x1350';
                      }
                    }
                  }
                  
                }

                if (duration > 60) {
                  newDuration = 60;
                }

                if (fps > 25) {
                  newFps = 25;
                }

                logger.log({
                  level: 'debug',
                  message: `El video original tiene un tamaño ${newSize}, con relación de aspecto ${newAspect}, duración ${newDuration}, y ${newFps} FPS`,
                  social: "Instagram",
                  user: `@${this.user}`
                });
                
                command.on('error', (err: any) => {
                  logger.log({
                    level: 'error',
                    message: `Error en FFMPEG al procesar el video`,
                    social: "Instagram",
                    user: `@${this.user}`
                  });
                  reject(err);
                });

                command.on('end', () => {
                  readFile(tempFilePath, async (err: any, data: Buffer) => {
                    try {
                      unlinkSync(tempFilePath);
                    } catch (error) {
                      
                    } finally {
                      if (err) reject(err);
                      let result = await thread.broadcastVideo({
                        video: data,
                      });
                      resolve(result);
                    }
                  });
                });

                command.size(newSize).aspect(newAspect).autopad().fps(newFps).duration(newDuration).save(tempFilePath); 
              } else {
                reject(err)
              }
            });
          });
        });

      } catch (error) {
        reject(error);
      }
    });
    
  }

}

