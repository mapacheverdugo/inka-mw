
require('dotenv').config()

import Instagram from "./controllers/instagram";
import Telegram from "./controllers/telegram";
import Facebook from "./controllers/facebook";

(async () => {
    try {
      //let ig = new Instagram(process.env.INSTAGRAM_USER_1, process.env.INSTAGRAM_PASS_1);
      //ig.init();

      //let tg = new Telegram("56965830745");
      //tg.init();

      let fb = new Facebook(process.env.FACEBOOK_PAGE_TOKEN);
      fb.init();
    } catch (error) {
      console.error("Error:", error);
    }
})();