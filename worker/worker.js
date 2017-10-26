"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
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
importScripts('wordmancore.js');
var WorkerClass = (function () {
    function WorkerClass() {
        var _this = this;
        addEventListener("message", function (ev) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            var data, id, func, result;
            return __generator(this, function (_a) {
                data = ev.data;
                id = data.id;
                try {
                    func = this[data.action];
                    if (typeof func != "function") {
                        postMessage({ id: id, failure: new Error("Worker does not have a function names " + data.action) });
                    }
                    else {
                        result = func.apply(this, data.args);
                        if (result instanceof Promise) {
                            result.then(function (promiseResult) { return postMessage({ id: id, result: promiseResult }); }, function (errObj) { return _this.postFailure(id, errObj); });
                        }
                        else {
                            postMessage({ id: id, result: result });
                        }
                    }
                }
                catch (exception) {
                    this.postFailure(id, exception);
                }
                return [2];
            });
        }); });
    }
    WorkerClass.prototype.postFailure = function (id, errorObj) {
        postMessage({ id: id, failure: { name: errorObj.name, message: errorObj.message, stack: errorObj.stack } });
    };
    return WorkerClass;
}());
var Actions = (function (_super) {
    __extends(Actions, _super);
    function Actions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.wordLists = new Map();
        return _this;
    }
    Actions.prototype.loadWordsFromUrl = function (url, name) {
        return __awaiter(this, void 0, void 0, function () {
            var fileContents, text, wordList;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, fetch(url)];
                    case 1:
                        fileContents = _a.sent();
                        return [4, fileContents.text()];
                    case 2:
                        text = _a.sent();
                        wordList = new WordList(text);
                        this.wordLists.set(name, wordList);
                        return [2, wordList.count()];
                }
            });
        });
    };
    Actions.prototype.findMatches = function (query, lists, options) {
        var matcher = new Pattern(false);
        var list = this.wordLists.get(lists[0]);
        if (!list) {
            throw new Error("word list " + lists[0] + " is not loaded");
        }
        return MatchDriver.findMatches(matcher, list, query, { mistakes: 0, reverse: false, maxReturn: 100 });
    };
    return Actions;
}(WorkerClass));
var myActions = new Actions();
//# sourceMappingURL=worker.js.map