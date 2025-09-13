import sourceMapSupport from "source-map-support";
import * as Homey from "homey";
import type HomeyLib from "homey/lib/Homey";
sourceMapSupport.install();

class LkApp extends Homey.App {
  public readonly homey!: HomeyLib;

  onInit() {
    this.log("Successfully init LK App");

    try {
      const action = this.homey.flow.getActionCard("cubicsecure_pause_alarm");
      action.registerRunListener(async (args) => {
        const device = args.device;
        const seconds = Number(args.seconds ?? 0);
        await (device as any).pauseLeakDetection(seconds);
        return true;
      });

      const cancel = this.homey.flow.getActionCard("cubicsecure_cancel_pause");
      cancel.registerRunListener(async (args) => {
        const device = args.device;
        await (device as any).pauseLeakDetection(0);
        return true;
      });
    } catch (e) {
      this.error("Failed to register CubicSecure flow actions", e);
    }
  }
}

module.exports = LkApp;
