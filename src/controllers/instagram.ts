
require('dotenv').config()

import { EventEmitter } from "events";
import oldFfmpeg from "ffmpeg";
import ffmpeg from "fluent-ffmpeg";
import { appendFile, readFile, unlinkSync } from "fs";
import { DirectThreadEntity, IgApiClient, IgCheckpointError, IgLoginTwoFactorRequiredError } from "instagram-private-api";
import {
  GraphQLSubscriptions, IgApiClientMQTT, SkywalkerSubscriptions, withFbnsAndRealtime
} from 'instagram_mqtt';
import fetch from "node-fetch";
import sharp from "sharp";
import tmp from "tmp";
import logger from "../common/social_logger";


const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

export default class WhatsApp extends EventEmitter {
  appKey: string;
  user: string;
  pass: string;
  twoFactorData: any;
  client: IgApiClientMQTT = withFbnsAndRealtime(new IgApiClient());

  constructor(appKey: string, user: string, pass: string) {
    super();
    this.appKey = appKey;
    this.user = user.replace("@", "");
    this.pass = pass;

  }

  public init = async () => {

    try {
      await this.login();

      await this.startListenAndAprovePendings();
      await this.startListener();
      return;
    } catch (error) {
      logger.log({
        level: 'error',
        message: `Error al inicializar: ${error}`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
      return;
    }
  }

  private login = async () => {
    try {
      logger.log({
        level: 'info',
        message: `Iniciando sesión...`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });

      if (this.user && this.pass) {
        this.client.state.generateDevice(this.user);
        await this.client.account.login(this.user, this.pass);
        return;
      } else {
        throw new Error("Falta usuario o contraseña");
      }
    } catch (error) {
      if (error instanceof IgCheckpointError) {
        logger.log({
          level: 'warn',
          message: `Requiere verificación, enviando código al correo...`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
        await this.client.challenge.selectVerifyMethod("1", false);
        return;
      } else if (error instanceof IgLoginTwoFactorRequiredError) {
        const { username, totp_two_factor_on, two_factor_identifier } = error.response.body.two_factor_info;
        const verificationMethod = totp_two_factor_on ? '0' : '1';

        this.twoFactorData = {
          verificationMethod,
          username,
          twoFactorIdentifier: two_factor_identifier
        }

        logger.log({
          level: 'warn',
          message: `Requiere 2FA, enviando código por ${verificationMethod === '1' ? 'SMS' : 'TOTP'}...`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
        return;
      } else {
        throw error;
      }

    }
  }

  public verificateLogin = async (code: string) => {
    logger.log({
      level: 'info',
      message: `Intentando verificar el inicio de sesión...`,
      social: "Instagram",
      user: `@${this.user}`,
      appKey: this.appKey
    });

    await this.client.challenge.sendSecurityCode(code);

    await this.startListenAndAprovePendings();
    await this.startListener();
    return;
  }

  public twoFactorLogin = async (code: string) => {
    try {
      logger.log({
        level: 'info',
        message: `Intentando verificar el inicio de sesión...`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });

      await this.client.account.twoFactorLogin({
        username: this.twoFactorData.username,
        verificationCode: code,
        twoFactorIdentifier: this.twoFactorData.twoFactorIdentifier,
        verificationMethod: this.twoFactorData.verificationMethod, // '1' = SMS (default); '0' = TOTP (google auth por ejemplo)
      });

      await this.startListenAndAprovePendings();
      await this.startListener();
      return;
    } catch (error) {
      if (error instanceof IgCheckpointError) {
        logger.log({
          level: 'warn',
          message: `Requiere verificación, enviando código al correo...`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
        await this.client.challenge.selectVerifyMethod("1", false);
        return;
      } else {
        throw error;
      }
    }
  }

  private sleep = (secs: number) => {
    return new Promise((resolve) => {
      setTimeout(resolve, secs * 1000);
    });
  }

  private startListenAndAprovePendings = async () => {
    // Se refresca cada intervalo
    if (process.env.INSTAGRAM_SEC_INTERVAL) {
      let secs = parseInt(process.env.INSTAGRAM_SEC_INTERVAL);
      secs = secs && secs < 60 ? 60 : secs;
      const min = secs * 0.66;
      const max = secs * 1.33;
      let interval = Math.floor(Math.random() * (max - min) + min);

      logger.log({
        level: 'silly',
        message: `Delay interval: ${interval} segundos`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });

      setInterval(async () => {
        logger.log({
          level: 'silly',
          message: `Obteniendo solicitudes de mensaje...`,
          social: "Instagram",
          user: `@${this.user}`
        });

        try {
          const pendings = await this.client.feed.directPending().items();

          if (pendings.length > 0) {
            logger.log({
              level: 'info',
              message: `Se encontraron ${pendings.length} solicitudes de mensajes que se aprobaran.`,
              social: "Instagram",
              user: `@${this.user}`
            });
          }

          for (const pending of pendings) {
            await this.client.directThread.approve(pending.thread_id);

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
        } finally {
          interval = Math.floor(Math.random() * (max - min) + min);
          logger.log({
            level: 'silly',
            message: `Delay interval: ${interval} segundos`,
            social: "Instagram",
            user: `@${this.user}`,
            appKey: this.appKey
          });
        }
      }, interval * 1000);
    }


    // Se escuchan las notificaciones
    await this.client.fbns.connect({
      autoReconnect: true
    });

    this.client.fbns.on('push', async (data) => {
      try {
        const secs = process.env.INSTAGRAM_SEC_DELAY ? parseInt(process.env.INSTAGRAM_SEC_DELAY) : 60
        const min = secs * 0.66;
        const max = secs * 1.33;
        const delay = Math.floor(Math.random() * (max - min) + min);

        logger.log({
          level: 'silly',
          message: `Delay push: ${delay} segundos`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });

        if (data.pushCategory === 'direct_v2_pending') {
          await this.sleep(delay);

          const pendings = await this.client.feed.directPending().items()
          if (pendings.length > 0) {
            logger.log({
              level: 'info',
              message: `Se encontraron ${pendings.length} solicitudes de mensajes que se aprobaran.`,
              social: "Instagram",
              user: `@${this.user}`,
              appKey: this.appKey
            });
          }

          for (const pending of pendings) {
            await this.client.directThread.approve(pending.thread_id);

            for (const item of pending.items) {
              this.logMessage(item);
              let parsedMessage = await this.parseMessage(item, pending.thread_id)
              this.emit('message', parsedMessage);
            }
          }
        }
      } catch (error) {
        logger.log({
          level: 'warn',
          message: `No se puedieron obtener los pendientes`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });

      }
    });
    return;
  }

  private startListener = async () => {
    logger.log({
      level: 'info',
      message: `Sesión iniciada correctamente. Escuchando mensajes...`,
      social: "Instagram",
      user: `@${this.user}`,
      appKey: this.appKey
    });

    try {
      await this.client.realtime.connect({
        graphQlSubs: [
          GraphQLSubscriptions.getAppPresenceSubscription(),
          GraphQLSubscriptions.getDirectStatusSubscription(),
          GraphQLSubscriptions.getDirectTypingSubscription(this.client.state.cookieUserId),
          GraphQLSubscriptions.getAsyncAdSubscription(this.client.state.cookieUserId),
        ],
        skywalkerSubs: [
          SkywalkerSubscriptions.directSub(this.client.state.cookieUserId),
          SkywalkerSubscriptions.liveSub(this.client.state.cookieUserId)
        ],
        irisData: await this.client.feed.directInbox().request(),
        connectOverrides: {},
      });

      let userId = await this.client.user.getIdByUsername(this.user);

      this.client.realtime.on('message', async (data) => {
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
            user: `@${this.user}`,
            appKey: this.appKey
          });
        }

      });
      return;
    } catch (error) {
      logger.log({
        level: 'warn',
        message: `No se pudo obtener el nombre de usuario`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
      return;
    }
  }

  private logMessage = (message: any) => {
    if (message.item_type == "text") {
      logger.log({
        level: 'info',
        message: `Se recibió: "${message.text}"`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
    } else if (message.item_type == "media") {
      if (message.media?.media_type == 1) {
        logger.log({
          level: 'info',
          message: `Se recibió una imagen: ${message.media?.image_versions2?.candidates[0].url}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
      } else {
        logger.log({
          level: 'info',
          message: `Se recibió un video: ${message.media?.video_versions?.[0].url}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
      }
    } else if (message.item_type == "voice_media") {
      logger.log({
        level: 'info',
        message: `Se recibió un mensaje de audio: ${message.voice_media?.media.audio.audio_src}`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
    } else if (message.item_type == "like") {
      logger.log({
        level: 'info',
        message: `Se recibió un like: "❤️"`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
    } else if (message.item_type == "animated_media") {
      logger.log({
        level: 'info',
        message: `Se recibió un GIF: ${message.animated_media?.images.fixed_height?.url}`,
        social: "Instagram",
        user: `@${this.user}`,
        appKey: this.appKey
      });
    } else if (message.item_type == "raven_media") {
      if (message.visual_media?.media?.media_type == 1) {
        logger.log({
          level: 'info',
          message: `Se recibió una imagen efímera: ${message.visual_media?.media?.image_versions2?.candidates[0].url}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
      } else {
        logger.log({
          level: 'info',
          message: `Se recibió un video efímero: ${message.visual_media?.media?.video_versions?.[1].url}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
      }
    }
  }

  private parseMessage = (message: any, threadId?: any) => {
    return new Promise(async (resolve, reject) => {
      let mensajeTexto = "";
      let attachmentType = "";
      let attachmentUrl = "";
      let userName = "";
      let userKey = threadId ? threadId : message.thread_id;

      try {
        let userInfo = await this.client.user.info(message.user_id.toString());
        if (userInfo.username && userInfo.username != "") {
          userName = userInfo.username;
        }
      } catch (error) {
        logger.log({
          level: 'error',
          message: `No se pudo obtener el nombre de usuario: ${error}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
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

  public sendMessage = async (message: any) => {
    try {
      let threads = await this.client.feed.directInbox().records();
      let thread;

      for (const t of threads) {
        if (t.threadId == message.userKey) {
          thread = t;
        }
      }

      if (thread) {
        if (message && message.type == "RESPONSE_MESSAGE") {
          if (message.msj.mensajeTexto && message.msj.mensajeTexto != "") {
            await this.sendText(thread, message.msj.mensajeTexto);
          }

          if (message.msj.attachmentType && message.msj.attachmentType != "" && message.msj.attachmentUrl && message.msj.attachmentUrl != "") {
            logger.log({
              level: 'debug',
              message: `Se recibio adjunto de typo ${message.msj.attachmentType}`,
              social: "Instagram",
              user: `@${this.user}`,
              appKey: this.appKey

            });
            if (message.msj.attachmentType.startsWith(IMAGE_TYPE)) {
              await this.sendImage(thread, message.msj.attachmentUrl);
            }
            if (message.msj.attachmentType.startsWith(AUDIO_TYPE)) {
              await this.sendAudio(thread, message.msj.attachmentUrl);
            }
            if (message.msj.attachmentType.startsWith(VIDEO_TYPE)) {
              await this.sendVideo(thread, message.msj.attachmentUrl);
            }
          }


        }
      }
    } catch (error) {

      if (error) {
        logger.log({
          level: 'warn',
          message: `${error.toString()}`,
          social: "Instagram",
          user: `@${this.user}`,
          appKey: this.appKey
        });
      } else {
        error = "Error desconocido";
      }

      let errorMessage = {
        keyApp: this.appKey,
        userKey: message.userKey,
        msj: {
          userName: message.userName,
          type: "PV",
          attachmentType: "",
          attachmentUrl: "",
          mensajeTexto: `No se pudo enviar mensaje. Error: ${error.toString()}`,
        },
        type: "new_message"
      }

      this.emit('message', errorMessage);
    }

  }

  private sendText = async (thread: DirectThreadEntity, text: string) => {
    let res = await thread.broadcastText(text);
    return res
  }

  private sendImage = (thread: DirectThreadEntity, url: string) => {
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

          let newSize = { width, height };
          let newAspect = aspect;

          if (width > 1080 || height > 1350 || aspect > 1.9 || aspect < 0.8) {
            if (aspect > 1.9) {
              if (width > 1080) {
                newAspect = 1.9;
                newSize = { width: 1080, height: width / newAspect };
              } else {
                newAspect = 1.9;
                newSize = { width, height: width / newAspect };
              }
            } else if (aspect < 0.8) {
              if (height > 1350) {
                newAspect = 0.8;
                newSize = { height: 1350, width: height * newAspect };
              } else {
                newAspect = 0.8;
                newSize = { height, width: height * newAspect };
              }
            } else {
              if (aspect > 1) {
                if (width > 1080) {
                  newSize = { width: 1080, height: width / newAspect };
                }
              } else if (aspect <= 1) {
                if (height > 1350) {
                  newSize = { height: 1350, width: height * newAspect };
                }
              }
            }

          }


          finalImageBuffer = await sharpImage.resize({ ...newSize, ...{ fit: "fill" } }).toFormat('jpeg').toBuffer();
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

  private sendAudio = (thread: DirectThreadEntity, url: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const audio = await fetch(url);
        const audioBuffer = await audio.buffer();
        tmp.file((err: any, path: any, fd: any, cleanup: any) => {
          if (err) { }

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
                  user: `@${this.user}`,
                  appKey: this.appKey
                });

                command.on('error', (err: any) => {
                  if (err) {
                    reject(err)
                  } else {
                    reject(new Error("Problema al transformar con ffmpeg"))
                  }
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
                if (err != null) {
                  reject(err)
                } else {
                  reject(new Error("Problema al obtener metadata con ffmpeg"))
                }
              }
            });
          });
        });




      } catch (error) {
        reject(error);
      }
    });

  }

  private sendVideo = (thread: DirectThreadEntity, url: string) => {
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
                if (video.metadata.filename && video.metadata.filename != "") {
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
                    user: `@${this.user}`,
                    appKey: this.appKey
                  });

                  command.on('error', (err: any) => {
                    if (err) {
                      reject(err)
                    } else {
                      reject(new Error("Problema al transformar con ffmpeg"))
                    }
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
                  if (err) {
                    reject(err)
                  } else {
                    reject(new Error("Problema al obtener metadata del archivo"))
                  }
                }
              } else {
                reject(new Error(`El archivo probablemente estaba corrupto`));
              }
            });
          });
        });

      } catch (error) {
        reject(error);
      }
    });

  }

  public destroy = async () => {
    await this.client.destroy();
  }

}

