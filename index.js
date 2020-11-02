
const {promisify} = require("util");
const { readFile } = require("fs");
const {
    withRealtime,
    
    GraphQLSubscriptions,
    SkywalkerSubscriptions,
} = require('instagram_mqtt');
const { IgApiClient } = require("instagram-private-api");
 
const readFileAsync = promisify(readFile);

const ig = withRealtime(new IgApiClient());

async function login() {
  ig.state.generateDevice("mapacheverdugo");
  await ig.account.login("mapacheverdugo", "ZL4|fWeQgpd*");
}


(async () => {
    try {
        console.log("Iniciando sesión en Instagram");
        await login();
      ig.realtime.on('message', (data) => {
        console.log("message", data);
        });

        await ig.realtime.connect({
            graphQlSubs: [
                GraphQLSubscriptions.getAppPresenceSubscription(),
                GraphQLSubscriptions.getZeroProvisionSubscription(ig.state.phoneId),
                GraphQLSubscriptions.getDirectStatusSubscription(),
                GraphQLSubscriptions.getDirectTypingSubscription(ig.state.cookieUserId),
                GraphQLSubscriptions.getAsyncAdSubscription(ig.state.cookieUserId),
            ],
            skywalkerSubs: [
                SkywalkerSubscriptions.directSub(ig.state.cookieUserId),
                SkywalkerSubscriptions.liveSub(ig.state.cookieUserId)
            ],
            
            irisData: await ig.feed.directInbox().request(),
        
            connectOverrides: {
            },
        });
    } catch (error) {
        console.log("No se pudo iniciar sesión en Instagram. Error:", error);
    }
})();

async function sendPhoto(thread) {
  const photo = await readFileAsync('PATH_TO_PHOTO.jpg');
  console.log(await thread.broadcastPhoto({
    file: photo,
  }));
}

async function sendVideo(thread) {
  const video = await readFileAsync('PATH_TO_VIDEO.mp4');
  console.log(await thread.broadcastVideo({
    video,
    // optional if you get a 202 transcode error
    // delay in ms
    transcodeDelay: 5 * 1000, // 5ms * 1000ms = 5s
  }));
}

async function sendVideoStory(thread) {
  const video = await readFileAsync('PATH_TO_VIDEO.mp4');
  const cover = await readFileAsync('PATH_TO_COVER.jpg');
  console.log(await thread.broadcastStory({
    video,
    coverImage: cover,
    viewMode: 'replayable',
  }));
}

async function sendPhotoStory(thread) {
  const photo = await readFileAsync('PATH_TO_PHOTO.jpg');
  console.log(await thread.broadcastStory({
    file: photo,
    viewMode: 'once',
  }));
}

