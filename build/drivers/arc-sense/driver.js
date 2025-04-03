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
var ArcSenseDriver = (function (_super) {
    __extends(ArcSenseDriver, _super);
    function ArcSenseDriver() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ArcSenseDriver.prototype.onInit = function () {
        this.log("MyDriver has been initialized");
    };
    ArcSenseDriver.prototype.onPair = function (session) {
        var _this = this;
        this.log("Pairing started");
        var email = "";
        var password = "";
        var realEstateId = "";
        session.setHandler("login", function (data) { return __awaiter(_this, void 0, void 0, function () {
            var userInfo, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.log("Login handler called");
                        this.log("Email provided: ".concat(data.username.substring(0, 3), "..."));
                        this.log("Password length:", data.password ? data.password.length : 0);
                        email = data.username;
                        password = data.password;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        this.log("Initializing LK API...");
                        this.api = new lk_api_1.LkApi(email, password, this.homey);
                        this.log("LK API initialized successfully");
                        this.log("Attempting to log in...");
                        return [4, this.api.login()];
                    case 2:
                        _a.sent();
                        return [4, this.api.getUserInfo()];
                    case 3:
                        userInfo = _a.sent();
                        this.log("Login successful for user:", userInfo.email);
                        return [2, true];
                    case 4:
                        error_1 = _a.sent();
                        if (error_1 instanceof Error) {
                            this.error("Login failed: ".concat(error_1.message));
                            if ("stack" in error_1) {
                                this.error("Error stack: ".concat(error_1.stack));
                            }
                        }
                        else {
                            this.error("Login failed with non-Error object:", error_1);
                        }
                        return [2, false];
                    case 5: return [2];
                }
            });
        }); });
        session.setHandler("list_realestates", function () { return __awaiter(_this, void 0, void 0, function () {
            var userInfo, structure, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.log("Listing real estates");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4, this.api.getUserInfo()];
                    case 2:
                        userInfo = _a.sent();
                        return [4, this.api.getUserStructure(userInfo.userId)];
                    case 3:
                        structure = _a.sent();
                        return [2, structure.map(function (estate) { return ({
                                name: estate.name,
                                data: {
                                    id: estate.realestateId,
                                    name: estate.name,
                                    address: estate.address,
                                    city: estate.city
                                }
                            }); })];
                    case 4:
                        error_2 = _a.sent();
                        this.error("Error listing real estates:", error_2);
                        return [2, []];
                    case 5: return [2];
                }
            });
        }); });
        session.setHandler("realestate_selection", function (data) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.log("Real estate selected:", data[0].name);
                realEstateId = data[0].data.id;
                return [2];
            });
        }); });
        session.setHandler("list_devices", function () { return __awaiter(_this, void 0, void 0, function () {
            var devices, arcSenseDevices, deviceItems, _i, arcSenseDevices_1, device, measurement, error_3, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.log("Listing Arc Sense devices");
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 10, , 11]);
                        return [4, this.api.getRealEstateMachines(realEstateId)];
                    case 2:
                        devices = _b.sent();
                        arcSenseDevices = devices.filter(function (device) { return device.deviceType === "ArcSense"; });
                        this.log("Found ".concat(arcSenseDevices.length, " Arc Sense devices"));
                        deviceItems = [];
                        _i = 0, arcSenseDevices_1 = arcSenseDevices;
                        _b.label = 3;
                    case 3:
                        if (!(_i < arcSenseDevices_1.length)) return [3, 9];
                        device = arcSenseDevices_1[_i];
                        measurement = {};
                        _b.label = 4;
                    case 4:
                        _b.trys.push([4, 6, , 7]);
                        return [4, this.api.getArcSenseMeasurement(device.identity)];
                    case 5:
                        measurement = _b.sent();
                        return [3, 7];
                    case 6:
                        error_3 = _b.sent();
                        this.error("Error getting measurement data for ".concat(device.identity, ":"), error_3);
                        return [3, 7];
                    case 7:
                        deviceItems.push({
                            name: ((_a = device.zone) === null || _a === void 0 ? void 0 : _a.zoneName) || device.identity,
                            data: {
                                id: device.identity,
                                mac: device.identity,
                                externalId: device.externalId,
                                realestateId: device.realestateId,
                                realestateMachineId: device.realestateMachineId
                            },
                            settings: {
                                email: email,
                                password: password,
                                interval: 30
                            },
                            capabilities: [
                                "measure_battery",
                                "measure_humidity",
                                "measure_signal_strength",
                                "target_temperature",
                                "measure_temperature",
                            ]
                        });
                        _b.label = 8;
                    case 8:
                        _i++;
                        return [3, 3];
                    case 9: return [2, deviceItems];
                    case 10:
                        error_4 = _b.sent();
                        this.error("Error listing devices:", error_4);
                        return [2, []];
                    case 11: return [2];
                }
            });
        }); });
    };
    return ArcSenseDriver;
}(homey_1.Driver));
module.exports = ArcSenseDriver;
//# sourceMappingURL=driver.js.map