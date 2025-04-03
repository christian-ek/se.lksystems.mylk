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
exports.__esModule = true;
var source_map_support_1 = require("source-map-support");
var Homey = require("homey");
source_map_support_1["default"].install();
var LkApp = (function (_super) {
    __extends(LkApp, _super);
    function LkApp() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LkApp.prototype.onInit = function () {
        this.log('Successfully init LK App');
    };
    return LkApp;
}(Homey.App));
module.exports = LkApp;
//# sourceMappingURL=app.js.map