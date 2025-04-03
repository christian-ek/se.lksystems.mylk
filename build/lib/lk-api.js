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
exports.LkApi = void 0;
var homey_1 = require("homey");
var axios_1 = require("axios");
var LkApi = (function (_super) {
    __extends(LkApi, _super);
    function LkApi(email, password, homey, apiHost) {
        if (apiHost === void 0) { apiHost = 'https://link2.lk.nu'; }
        var _this = _super.call(this) || this;
        _this.SUBSCRIPTION_KEY = 'deb63224fa0443d5a8e9167e88b4b4d9';
        _this.homey = homey;
        _this.email = email;
        _this.password = password;
        _this.baseUrl = apiHost;
        var storedAccessToken = _this.homey.settings.get('lkAccessToken');
        var storedRefreshToken = _this.homey.settings.get('lkRefreshToken');
        if (typeof storedAccessToken === 'string') {
            _this.accessToken = storedAccessToken;
        }
        if (typeof storedRefreshToken === 'string') {
            _this.refreshToken = storedRefreshToken;
        }
        if (!email || !password) {
            _this.error('Email and password not found in config');
            throw new Error('Not all required configuration values found. Need "email" and "password".');
        }
        axios_1["default"].defaults.baseURL = _this.baseUrl;
        axios_1["default"].defaults.headers.common = {
            'Content-Type': 'application/json',
            'Api-Version': '1.0',
            'Ocp-Apim-Subscription-Key': _this.SUBSCRIPTION_KEY
        };
        axios_1["default"].interceptors.response.use(function (response) { return response; }, function (error) { return __awaiter(_this, void 0, void 0, function () {
            var loginResponse, authError_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!error.response || error.response.status !== 401) {
                            return [2, Promise.reject(error)];
                        }
                        if (((_a = error.config) === null || _a === void 0 ? void 0 : _a.url) === '/auth/auth/login') {
                            return [2, Promise.reject(error)];
                        }
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4, this.login()];
                    case 2:
                        loginResponse = _b.sent();
                        if (error.config) {
                            if (error.config.headers) {
                                error.config.headers.Authorization = "Bearer ".concat(loginResponse.accessToken);
                            }
                            return [2, axios_1["default"].request(error.config)];
                        }
                        return [2, Promise.reject(new Error('Request config not available'))];
                    case 3:
                        authError_1 = _b.sent();
                        return [2, Promise.reject(authError_1)];
                    case 4: return [2];
                }
            });
        }); });
        return _this;
    }
    LkApi.prototype.login = function () {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var data, response, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        data = {
                            email: this.email,
                            password: this.password
                        };
                        this.log("Sending login request with email: ".concat(this.email));
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4, axios_1["default"].post('/auth/auth/login', data)];
                    case 2:
                        response = _b.sent();
                        this.accessToken = response.data.accessToken;
                        this.refreshToken = response.data.refreshToken;
                        this.homey.settings.set('lkAccessToken', response.data.accessToken);
                        this.homey.settings.set('lkRefreshToken', response.data.refreshToken);
                        this.log("Authentication successful, token expires in ".concat(response.data.accessTokenExpire, " seconds"));
                        return [2, response.data];
                    case 3:
                        error_1 = _b.sent();
                        if (axios_1["default"].isAxiosError(error_1) && ((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.status) === 401) {
                            this.error('Authentication failed: Invalid credentials');
                            throw new Error('Invalid email or password');
                        }
                        errorMessage = error_1 instanceof Error ? error_1.message : String(error_1);
                        this.error("Authentication failed: ".concat(errorMessage));
                        throw error_1;
                    case 4: return [2];
                }
            });
        });
    };
    LkApi.prototype.refreshAccessToken = function () {
        return __awaiter(this, void 0, void 0, function () {
            var data, response, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.refreshToken) {
                            throw new Error('No refresh token available, please log in first');
                        }
                        data = {
                            refreshToken: this.refreshToken
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, axios_1["default"].post('/auth/auth/refresh', data)];
                    case 2:
                        response = _a.sent();
                        this.accessToken = response.data.accessToken;
                        this.refreshToken = response.data.refreshToken;
                        this.homey.settings.set('lkAccessToken', response.data.accessToken);
                        this.homey.settings.set('lkRefreshToken', response.data.refreshToken);
                        this.log("Token refreshed successfully, new token expires in ".concat(response.data.accessTokenExpire, " seconds"));
                        return [2, response.data];
                    case 3:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                        this.error("Token refresh failed: ".concat(errorMessage));
                        throw error_2;
                    case 4: return [2];
                }
            });
        });
    };
    LkApi.prototype.getUserInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest('/auth/auth/user')];
            });
        });
    };
    LkApi.prototype.getUserStructure = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/users/user/".concat(userId, "/structure/false"))];
            });
        });
    };
    LkApi.prototype.getRealEstateTitle = function (realestateId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/structure/realestate/".concat(realestateId, "/title/false"))];
            });
        });
    };
    LkApi.prototype.getRealEstateMeasurements = function (realestateId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/structure/realestate/".concat(realestateId, "/measurements/false"))];
            });
        });
    };
    LkApi.prototype.getRealEstateMachines = function (realestateId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/structure/realestate/".concat(realestateId, "/realestateMachines/false"))];
            });
        });
    };
    LkApi.prototype.getArcHubConfiguration = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/arc/hub/".concat(serialNumber, "/configuration/false"))];
            });
        });
    };
    LkApi.prototype.getArcHubMeasurement = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/arc/hub/".concat(serialNumber, "/measurement/false"))];
            });
        });
    };
    LkApi.prototype.getArcHubStructure = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/arc/hub/".concat(serialNumber, "/structure/false"))];
            });
        });
    };
    LkApi.prototype.getArcSenseConfiguration = function (mac) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/arc/sense/".concat(mac, "/configuration/false"))];
            });
        });
    };
    LkApi.prototype.getArcSenseMeasurement = function (mac) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/arc/sense/".concat(mac, "/measurement/false"))];
            });
        });
    };
    LkApi.prototype.getCubicSecureConfiguration = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/cubic/secure/".concat(serialNumber, "/configuration/false"))];
            });
        });
    };
    LkApi.prototype.getCubicSecureMeasurement = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/cubic/secure/".concat(serialNumber, "/measurement/false"))];
            });
        });
    };
    LkApi.prototype.getCubicDetectorConfiguration = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/cubic/detector/".concat(serialNumber, "/configuration/false"))];
            });
        });
    };
    LkApi.prototype.getCubicDetectorMeasurement = function (serialNumber) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/cubic/detector/".concat(serialNumber, "/measurement/false"))];
            });
        });
    };
    LkApi.prototype.getDeviceInformation = function (deviceIdentity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/devices/device/".concat(deviceIdentity, "/information/false"))];
            });
        });
    };
    LkApi.prototype.getDeviceTitle = function (deviceIdentity) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2, this.makeAuthorizedRequest("/service/devices/device/".concat(deviceIdentity, "/title/false"))];
            });
        });
    };
    LkApi.prototype.updateArcSenseTemperature = function (mac, desiredTemperature) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        data = { desiredTemperature: desiredTemperature };
                        return [4, this.makeAuthorizedRequest("/service/arc/sense/".concat(mac, "/setpoint/false"), 'PUT', data)];
                    case 1:
                        _a.sent();
                        return [2, true];
                    case 2:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                        this.error("Failed to update temperature: ".concat(errorMessage));
                        return [2, false];
                    case 3: return [2];
                }
            });
        });
    };
    LkApi.prototype.updateArcHubMode = function (serialNumber, mode) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        data = { mode: mode };
                        return [4, this.makeAuthorizedRequest("/service/arc/hub/".concat(serialNumber, "/mode/false"), 'PUT', data)];
                    case 1:
                        _a.sent();
                        return [2, true];
                    case 2:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : String(error_4);
                        this.error("Failed to update hub mode: ".concat(errorMessage));
                        return [2, false];
                    case 3: return [2];
                }
            });
        });
    };
    LkApi.prototype.updateArcHubLeds = function (serialNumber, ledsEnabled) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        data = { ledsEnabled: ledsEnabled };
                        return [4, this.makeAuthorizedRequest("/service/arc/hub/".concat(serialNumber, "/leds/false"), 'PUT', data)];
                    case 1:
                        _a.sent();
                        return [2, true];
                    case 2:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : String(error_5);
                        this.error("Failed to update LED state: ".concat(errorMessage));
                        return [2, false];
                    case 3: return [2];
                }
            });
        });
    };
    LkApi.prototype.updateCubicSecureValveState = function (serialNumber, valveState) {
        return __awaiter(this, void 0, void 0, function () {
            var data, error_6, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        data = { valveState: valveState };
                        return [4, this.makeAuthorizedRequest("/service/cubic/secure/".concat(serialNumber, "/valve/false"), 'PUT', data)];
                    case 1:
                        _a.sent();
                        return [2, true];
                    case 2:
                        error_6 = _a.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : String(error_6);
                        this.error("Failed to update valve state: ".concat(errorMessage));
                        return [2, false];
                    case 3: return [2];
                }
            });
        });
    };
    LkApi.prototype.makeAuthorizedRequest = function (url, method, data) {
        var _a;
        if (method === void 0) { method = 'GET'; }
        return __awaiter(this, void 0, void 0, function () {
            var config, response, error_7, retryResponse, refreshError_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this.accessToken) return [3, 2];
                        return [4, this.login()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        config = {
                            method: method,
                            url: url,
                            headers: {
                                'Authorization': "Bearer ".concat(this.accessToken)
                            },
                            data: data
                        };
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 11]);
                        this.log("Making ".concat(method, " request to: ").concat(url));
                        return [4, (0, axios_1["default"])(config)];
                    case 4:
                        response = _b.sent();
                        return [2, response.data];
                    case 5:
                        error_7 = _b.sent();
                        if (!(axios_1["default"].isAxiosError(error_7) &&
                            ((_a = error_7.response) === null || _a === void 0 ? void 0 : _a.status) === 401 &&
                            this.refreshToken)) return [3, 10];
                        this.log('Token expired, attempting to refresh');
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 9, , 10]);
                        return [4, this.refreshAccessToken()];
                    case 7:
                        _b.sent();
                        if (config.headers) {
                            config.headers.Authorization = "Bearer ".concat(this.accessToken);
                        }
                        return [4, (0, axios_1["default"])(config)];
                    case 8:
                        retryResponse = _b.sent();
                        return [2, retryResponse.data];
                    case 9:
                        refreshError_1 = _b.sent();
                        this.error('Token refresh failed, will need to re-authenticate');
                        throw refreshError_1;
                    case 10:
                        errorMessage = error_7 instanceof Error ? error_7.message : String(error_7);
                        this.error("Error calling ".concat(url, ": ").concat(errorMessage));
                        throw error_7;
                    case 11: return [2];
                }
            });
        });
    };
    return LkApi;
}(homey_1.SimpleClass));
exports.LkApi = LkApi;
//# sourceMappingURL=lk-api.js.map