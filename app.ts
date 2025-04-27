import sourceMapSupport from "source-map-support";
import * as Homey from "homey";
sourceMapSupport.install();

class LkApp extends Homey.App {
  onInit() {
    this.log("Successfully init LK App");
  }
}

module.exports = LkApp;
