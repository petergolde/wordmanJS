"use strict";
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
$(function () {
    Program.start();
});
$("#search_button").click(function (e) {
    var queryText = $("#query_text").val();
    Program.findMatches(queryText);
});
var AsyncWorker = (function () {
    function AsyncWorker(scriptUrl) {
        var _this = this;
        this.workerMethodId = 0;
        this.promises = new Map();
        this.scriptUrl = scriptUrl;
        this.loadWorker();
        this.worker.addEventListener('message', function (ev) {
            if (ev.data.hasOwnProperty('result')) {
                _this.resultReturned(ev.data.id, ev.data.result);
            }
            else if (ev.data.hasOwnProperty('failure')) {
                _this.failureReturned(ev.data.id, ev.data.failure);
            }
        });
        this.worker.addEventListener('error', function (ev) {
            _this.loadWorker();
        });
    }
    AsyncWorker.prototype.execute = function (action) {
        var _this = this;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        if (this.workerIsRunning) {
            throw new Error("Cannot execute new work while the working is busy.");
        }
        this.workerIsRunning = true;
        this.workerMethodId += 1;
        var currentId = this.workerMethodId;
        this.worker.postMessage({ id: currentId, action: action, args: args });
        return new Promise(function (resolve, reject) {
            _this.promises.set(currentId, { resolve: resolve, reject: reject });
        });
    };
    AsyncWorker.prototype.isBusy = function () {
        return this.workerIsRunning;
    };
    AsyncWorker.prototype.reset = function () {
        this.loadWorker();
    };
    AsyncWorker.prototype.resultReturned = function (id, result) {
        this.workerIsRunning = false;
        var promise = this.promises.get(id);
        this.promises.delete(id);
        if (promise) {
            promise.resolve(result);
        }
    };
    AsyncWorker.prototype.failureReturned = function (id, reason) {
        this.workerIsRunning = false;
        var promise = this.promises.get(id);
        this.promises.delete(id);
        if (promise) {
            promise.reject(reason);
        }
    };
    AsyncWorker.prototype.loadWorker = function () {
        if (this.worker) {
            this.worker.terminate();
        }
        this.worker = new Worker(this.scriptUrl);
    };
    return AsyncWorker;
}());
var Program = (function () {
    function Program() {
    }
    Program.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var totalWords;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.initWorker();
                        $("h1").html("Loading word list.");
                        return [4, this.loadWordLists()];
                    case 1:
                        totalWords = _a.sent();
                        $("h1").html("Word lists loaded with " + totalWords + " total words.");
                        return [2];
                }
            });
        });
    };
    Program.initWorker = function () {
        this.worker = new AsyncWorker('/worker/worker.js');
    };
    Program.loadWordLists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var totalWords, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        totalWords = 0;
                        _a = totalWords;
                        return [4, this.loadWordListFromUrl("/Common%20words.words.txt", "Common words")];
                    case 1:
                        totalWords = _a + _b.sent();
                        return [2, totalWords];
                }
            });
        });
    };
    Program.loadWordListFromUrl = function (url, name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, this.worker.execute("loadWordsFromUrl", url, name)];
                    case 1: return [2, _a.sent()];
                }
            });
        });
    };
    Program.findMatches = function (query) {
        return __awaiter(this, void 0, void 0, function () {
            var matchResult, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        $("h1").html("Beginning search");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, this.worker.execute("findMatches", query, ["Common words"], { mistakes: 0, reverse: false, maxReturn: 100 })];
                    case 2:
                        matchResult = _a.sent();
                        $("h1").html("Matched " + matchResult.matches.length + " words");
                        $("#results").html(matchResult.matches.join("\r\n"));
                        return [3, 4];
                    case 3:
                        err_1 = _a.sent();
                        $("h1").html("Exception occurred: " + err_1.message);
                        $("#results").html("name: " + err_1.name + " message: " + err_1.message + " stack: " + err_1.stack);
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    return Program;
}());
//# sourceMappingURL=app.js.map