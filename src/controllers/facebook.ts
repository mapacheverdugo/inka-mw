const { Messenger } = require('fbmessenger');

const IMAGE_TYPE = "image";
const VIDEO_TYPE = "video";
const AUDIO_TYPE = "audio";

const showSelfMessages = true;
const showLogs = true;

export default class FacebookPage {
  messenger: any;

  constructor(pageAccessToken: string | undefined) {
    this.messenger = new Messenger({
      pageAccessToken
    });
  }

  init = async () => {
    try {
      this.startListener();
    } catch (error) {
      console.log("Error", error)
    }
  }

  startListener = () => {
    if (showLogs) console.log(`[Facebook] Acceso correcto. Escuchando mensajes...`);

    this.messenger.on('message', (event: any) => {
      console.log(event);
    });
    this.messenger.on('postback', (event: any) => {
      console.log(event);
    });
    
  }
}
