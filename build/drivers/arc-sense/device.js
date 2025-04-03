"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var homey_1 = require("homey");
var lk_api_1 = require("../../lib/lk-api");
var ArcSenseDevice = (function (_super) {
    __extends(ArcSenseDevice, _super);
    function ArcSenseDevice() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.pauseDeviceUpdates = false;
        return _this;
    }
    ArcSenseDevice.prototype.onInit = function () {
        return __awaiter(this, void 0, void 0, function () {
            var updateInterval;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.log("ArcSense device has been initialized");
                        this.device = this.getData();
                        this.printInfo();
                        this.api = new lk_api_1.LkApi(this.getSetting("email"), this.getSetting("password"), this.homey);
                        updateInterval = Number(this.getSetting("interval")) * 1000;
                        if (!updateInterval || updateInterval < 10000) {
                            updateInterval = 10000;
                        }
                        this.log("[".concat(this.getName(), "][").concat(this.device.mac, "]"), "Update Interval: ".concat(updateInterval));
                        this.registerCapabilityListener("target_temperature", this.onCapabilitySetTemperature.bind(this));
                        return [4, this.getDeviceData()];
                    case 1:
                        _a.sent();
                        this.interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4, this.getDeviceData()];
                                    case 1:
                                        _a.sent();
                                        return [2];
                                }
                            });
                        }); }, updateInterval);
                        return [2];
                }
            });
        });
    };
    ArcSenseDevice.prototype.getDeviceData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var device, data, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        device = this.device;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        return [4, this.api.getArcSenseMeasurement(device.mac)];
                    case 2:
                        data = _a.sent();
                        this.log("Received ArcSense measurement data:", data);
                        if (!!this.pauseDeviceUpdates) return [3, 4];
                        return [4, this.setCapabilityValue("target_temperature", parseFloat(data.desiredTemperature.toString()))["catch"](function (error) {
                                return _this.error("Error setting target_temperature:", error);
                            })];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [4, this.setCapabilityValue("measure_temperature", parseFloat(data.currentTemperature.toString()))["catch"](function (error) {
                            return _this.error("Error setting measure_temperature:", error);
                        })];
                    case 5:
                        _a.sent();
                        return [4, this.setCapabilityValue("measure_humidity", parseFloat(data.currentHumidity.toString()))["catch"](function (error) { return _this.error("Error setting measure_humidity:", error); })];
                    case 6:
                        _a.sent();
                        return [4, this.setCapabilityValue("measure_battery", parseFloat(data.currentBattery.toString()))["catch"](function (error) { return _this.error("Error setting measure_battery:", error); })];
                    case 7:
                        _a.sent();
                        return [4, this.setCapabilityValue("measure_signal_strength", parseFloat(data.currentRssi.toString()))["catch"](function (error) {
                                return _this.error("Error setting measure_signal_strength:", error);
                            })];
                    case 8:
                        _a.sent();
                        return [3, 10];
                    case 9:
                        error_1 = _a.sent();
                        this.error("Error fetching device data:", error_1);
                        return [3, 10];
                    case 10: return [2];
                }
            });
        });
    };
    ArcSenseDevice.prototype.onCapabilitySetTemperature = function (value) {
        return __awaiter(this, void 0, void 0, function () {
            var result, error_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        this.log("Setting temperature to ".concat(value, "\u00B0C"));
                        return [4, this.setCapabilityValue("target_temperature", value)];
                    case 1:
                        _a.sent();
                        return [4, this.api.updateArcSenseTemperature(this.device.mac, value)];
                    case 2:
                        result = _a.sent();
                        if (result) {
                            this.log("Temperature updated successfully");
                            this.pauseDeviceUpdates = true;
                            setTimeout(function () {
                                _this.pauseDeviceUpdates = false;
                            }, 30000);
                        }
                        else {
                            this.error("Failed to update temperature");
                        }
                        return [3, 4];
                    case 3:
                        error_2 = _a.sent();
                        this.error("Error setting temperature:", error_2);
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    ArcSenseDevice.prototype.printInfo = function () {
        this.log("name:", this.getName());
        this.log("class:", this.getClass());
        this.log("data", this.getData());
        this.log("settings", {
            email: this.getSetting("email"),
            interval: this.getSetting("interval")
        });
    };
    ArcSenseDevice.prototype.onAdded = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.log("ArcSense device has been added");
                this.printInfo();
                return [2];
            });
        });
    };
    ArcSenseDevice.prototype.onRenamed = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.log("Device renamed to: ".concat(name));
                return [2];
            });
        });
    };
    ArcSenseDevice.prototype.setUpdateInterval = function (newInterval) {
        var _this = this;
        var updateInterval = Number(newInterval) * 1000;
        if (!updateInterval || updateInterval < 10000) {
            updateInterval = 10000;
        }
        this.log("Creating update interval with ".concat(updateInterval, "ms"));
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.getDeviceData()];
                    case 1:
                        _a.sent();
                        return [2];
                }
            });
        }); }, updateInterval);
    };
    ArcSenseDevice.prototype.onSettings = function (_a) {
        var oldSettings = _a.oldSettings, newSettings = _a.newSettings, changedKeys = _a.changedKeys;
        return __awaiter(this, void 0, void 0, function () {
            var _i, changedKeys_1, name_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        for (_i = 0, changedKeys_1 = changedKeys; _i < changedKeys_1.length; _i++) {
                            name_1 = changedKeys_1[_i];
                            if (name_1 !== "password") {
                                this.log("Setting '".concat(name_1, "' changed from '").concat(oldSettings[name_1], "' to '").concat(newSettings[name_1], "'"));
                            }
                        }
                        if (oldSettings.interval !== newSettings.interval) {
                            this.log("Updating interval from ".concat(oldSettings.interval, "s to ").concat(newSettings.interval, "s"));
                            this.setUpdateInterval(newSettings.interval);
                        }
                        if (!(changedKeys.includes("email") || changedKeys.includes("password"))) return [3, 2];
                        this.log("API credentials changed, reinitializing API");
                        this.api = new lk_api_1.LkApi(newSettings.email, newSettings.password, this.homey);
                        return [4, this.getDeviceData()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2: return [2];
                }
            });
        });
    };
    ArcSenseDevice.prototype.onDeleted = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.log("Device deleted: ".concat(this.getName()));
                if (this.interval) {
                    clearInterval(this.interval);
                }
                return [2];
            });
        });
    };
    return ArcSenseDevice;
}(homey_1["default"].Device));
exports["default"] = ArcSenseDevice;
//# sourceMappingURL=device.js.map