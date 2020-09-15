"use strict";
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
        while (_) try {
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
$(function () {
    $("#querytype-select > option[value=pattern]").attr('selected', "true");
    Program.start();
    $("#main_form").submit(function (e) {
        var queryText = $("#query_text").val();
        Program.findMatches(queryText);
        e.preventDefault();
    });
    $("#search_results_button").click(function (e) {
        var queryText = $("#query_text").val();
        Program.findMatchesInCurrentResults(queryText);
        e.preventDefault();
    });
    $("#back_button").click(function (e) {
        Program.backButtonClicked();
    });
    $("#sort-select-1").change(function (e) {
        Program.resize();
    });
    $("#sort-select-2").change(function (e) {
        Program.resize();
    });
    $("#querytype-select").change(function (e) {
        Program.updateHelp();
    });
    $("#addwordlist").click(function (e) {
        Program.addWordList();
    });
    $("#customwordlistselected").click(function (e) {
        Program.selectedWordList();
    });
    $(window).resize(function (e) {
        Program.resize();
    });
});
var AsyncWorker = (function () {
    function AsyncWorker(scriptUrl) {
        var _this = this;
        this.workerMethodId = 0;
        this.promises = new Map();
        this.scriptUrl = scriptUrl;
        this.worker = this.loadWorker();
        this.workerIsRunning = false;
        this.worker.addEventListener('message', function (ev) {
            if (ev.data.hasOwnProperty('result')) {
                _this.resultReturned(ev.data.id, ev.data.result);
            }
            else if (ev.data.hasOwnProperty('failure')) {
                _this.failureReturned(ev.data.id, ev.data.failure);
            }
        });
        this.worker.addEventListener('error', function (ev) {
            console.error("Error in web worker: " + ev);
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
            throw new Error("Cannot execute new work while the worker is busy.");
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
        return this.worker;
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
                        this.showWordListUi();
                        this.updateHelp();
                        this.showAlert("Loading word list.", this.yellowColor);
                        return [4, this.loadWordLists()];
                    case 1:
                        totalWords = _a.sent();
                        this.showAlert("Word lists loaded with " + totalWords + " total words.", this.greenColor);
                        return [2];
                }
            });
        });
    };
    Program.setHelpText = function (matcher) {
        var helpElement;
        helpElement = $("#help-" + matcher);
        $("#helplocation").html(helpElement.html());
    };
    Program.updateHelp = function () {
        var matchType = this.collectMatchType();
        this.setHelpText(matchType);
    };
    Program.backButtonClicked = function () {
        this.showResults(false);
    };
    Program.showResults = function (showResults) {
        if (showResults) {
            $("#results_pane").addClass("show-results");
            $("#header").removeClass("show-header");
        }
        else {
            $("#results_pane").removeClass("show-results");
            $("#header").addClass("show-header");
        }
    };
    Program.findMatchesCore = function (query, wordListsToSearch) {
        return __awaiter(this, void 0, void 0, function () {
            var matchType, matchOptions, matchResult, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.showAlert("Beginning search", this.yellowColor);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        matchType = this.collectMatchType();
                        matchOptions = this.collectOptions();
                        if (wordListsToSearch.length === 0) {
                            this.showAlert("No word lists selected", this.redColor);
                            $("#search_results_button").prop("disabled", true);
                            return [2];
                        }
                        this.showResults(true);
                        return [4, this.worker.execute("findMatches", query, matchType, wordListsToSearch, matchOptions)];
                    case 2:
                        matchResult = _a.sent();
                        if (matchResult.hitMaximum) {
                            this.showAlert("Too many words found. Showing first " + matchResult.matches.length + " words.", this.yellowColor);
                        }
                        else {
                            this.showAlert("Matched " + matchResult.matches.length + " words", this.greenColor);
                        }
                        this.currentResults = matchResult.matches;
                        this.displayResults(this.currentResults);
                        this.updateSaveButton(this.currentResults);
                        if (matchResult.matches.length > 0) {
                            $("#search_results_button").prop("disabled", false);
                        }
                        else {
                            $("#search_results_button").prop("disabled", true);
                        }
                        return [3, 4];
                    case 3:
                        err_1 = _a.sent();
                        this.showAlert(err_1.message, this.redColor);
                        $("#results").html("");
                        $("#search_results_button").prop("disabled", true);
                        this.updateSaveButton([]);
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    Program.findMatches = function (query) {
        var wordListsToSearch = this.collectWordLists();
        return this.findMatchesCore(query, wordListsToSearch);
    };
    Program.findMatchesInCurrentResults = function (query) {
        var wordListsToSearch = ["current_results"];
        return this.findMatchesCore(query, wordListsToSearch);
    };
    Program.resize = function () {
        if (this.currentResults) {
            this.displayResults(this.currentResults);
        }
    };
    Program.displayResultsInColumns = function (results) {
        var maxLength = 0;
        for (var _i = 0, results_1 = results; _i < results_1.length; _i++) {
            var word = results_1[_i];
            if (word.length > maxLength) {
                maxLength = word.length;
            }
        }
        var charHeight = 16;
        var rows = Math.floor(($("#results_container").outerHeight() - 16) / charHeight);
        var cols = Math.ceil(results.length / rows);
        var wrappedText = "";
        for (var row = 0; row < rows; ++row) {
            for (var col = 0; col < cols; ++col) {
                var index = col * rows + row;
                if (index < results.length) {
                    var word = results[index];
                    wrappedText += word + this.padding.substr(0, maxLength + 5 - word.length);
                }
            }
            wrappedText += "\r\n";
        }
        $("#results").html(wrappedText);
    };
    Program.getResultsAsText = function (results) {
        var wrappedText = "";
        for (var _i = 0, results_2 = results; _i < results_2.length; _i++) {
            var word = results_2[_i];
            wrappedText += word;
            wrappedText += "\r\n";
        }
        return wrappedText;
    };
    Program.displayResultsInRows = function (results) {
        var wrappedText = this.getResultsAsText(results);
        $("#results").html(wrappedText);
    };
    Program.displayResults = function (results) {
        var mobile = ($("#back_bar").css("display") != "none");
        var sorting;
        if (mobile) {
            sorting = $("#sort-select-2").val();
        }
        else {
            sorting = $("#sort-select-1").val();
        }
        if (sorting == "length") {
            results = results.sort(function (s1, s2) {
                if (s1.length < s2.length) {
                    return 1;
                }
                else if (s1.length > s2.length) {
                    return -1;
                }
                else {
                    return s1.localeCompare(s2);
                }
            });
        }
        else {
            results = results.sort();
        }
        if (mobile) {
            this.displayResultsInRows(results);
        }
        else {
            this.displayResultsInColumns(results);
        }
    };
    Program.updateSaveButton = function (results) {
        var _this = this;
        var saveLink = $(".download-results");
        if (results && results.length > 0) {
            var resultsText = this.getResultsAsText(results);
            var blob = new Blob([resultsText], { type: 'text/plain' });
            if (this.blobUrl) {
                window.URL.revokeObjectURL(this.blobUrl);
                this.blobUrl = "";
            }
            this.blobUrl = window.URL.createObjectURL(blob);
            saveLink.each(function (number, element) {
                element.href = _this.blobUrl;
            });
            saveLink.removeClass("disabled");
        }
        else {
            saveLink.addClass("disabled");
        }
    };
    Program.initWorker = function () {
        this.worker = new AsyncWorker('/worker/worker.js');
    };
    Program.loadWordLists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var totalWords, _i, _a, wl, url, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        totalWords = 0;
                        _i = 0, _a = this.builtInWordLists;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3, 4];
                        wl = _a[_i];
                        url = "/wordlists/" + wl.replace(/ /, "%20") + ".words.txt";
                        _b = totalWords;
                        return [4, this.loadWordListFromUrl(url, wl)];
                    case 2:
                        totalWords = _b + _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3, 1];
                    case 4: return [2, totalWords];
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
    Program.showWordListUi = function () {
        var container = $("#wordlist-container");
        container.empty();
        for (var _i = 0, _a = this.builtInWordLists.concat(this.customWordLists); _i < _a.length; _i++) {
            var wl = _a[_i];
            if (wl == "Common words" || wl == "ENABLE") {
                container.append("<input type=\"checkbox\" value=\"" + wl + "\" checked/> " + wl + "<br />");
            }
            else {
                container.append("<input type=\"checkbox\" value=\"" + wl + "\"/> " + wl + "<br />");
            }
        }
    };
    Program.collectOptions = function () {
        return {
            reverse: $("#reverse-checkbox").prop('checked'),
            mistakes: parseInt($("#mistakes-select").val()),
            minLength: parseInt($("#minlength-select").val()),
            maxLength: parseInt($("#maxlength-select").val()),
            maxReturn: 10000
        };
    };
    Program.collectWordLists = function () {
        var wordLists = [];
        var wordListCheckboxes = $("#wordlist-container input");
        for (var i = 0; i < wordListCheckboxes.length; ++i) {
            if (wordListCheckboxes.eq(i).prop('checked')) {
                wordLists.push(wordListCheckboxes.eq(i).val());
            }
        }
        return wordLists;
    };
    Program.collectMatchType = function () {
        return $("#querytype-select").val();
    };
    Program.showAlert = function (text, color) {
        $(".message-line").html(text).css("background-color", color);
    };
    Program.addWordList = function () {
        $("#wordlistname").val("");
        $("#customwordlistfile").val("");
        $("#customWordListModal").modal();
    };
    Program.selectedWordList = function () {
        var _this = this;
        $("#customWordListModal").modal('hide');
        var wordListName = ($("#wordlistname").val());
        var wordListFile;
        var wordListFileElement = $("#customwordlistfile")[0];
        if (wordListFileElement.files == null || wordListFileElement.files.length == 0) {
            this.showAlert("No file was selected", this.redColor);
            return;
        }
        else {
            wordListFile = wordListFileElement.files[0];
        }
        if (wordListName.length == 0) {
            this.showAlert("A word list name must be supplied", this.redColor);
            return;
        }
        var fileReader = new FileReader();
        var fileText = "";
        fileReader.onload = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (fileReader.result == null) {
                            this.showAlert("Could not read word list file", this.redColor);
                            return [2];
                        }
                        fileText = fileReader.result;
                        if (fileText.length == 0) {
                            this.showAlert("Could not read word list file", this.redColor);
                            return [2];
                        }
                        return [4, this.worker.execute("loadWordsFromString", fileText, wordListName)];
                    case 1:
                        _a.sent();
                        this.customWordLists.push(wordListName);
                        this.showAlert("Word list '" + wordListName + "' successfully loaded", this.greenColor);
                        this.showWordListUi();
                        return [2];
                }
            });
        }); };
        fileReader.readAsText(wordListFile);
    };
    Program.getTextWidth = function (text, font) {
        var canvas = this.canvasCache || (this.canvasCache = document.createElement("canvas"));
        var context = canvas.getContext("2d");
        context.font = font;
        var metrics = context.measureText(text);
        return metrics.width;
    };
    Program.greenColor = "#bbffaa";
    Program.yellowColor = "#ffffaa";
    Program.redColor = "#ffaaaa";
    Program.currentResults = [];
    Program.padding = "                                                                                                           ";
    Program.builtInWordLists = [
        "Common words", "ENABLE", "ENABLE rare words", "Idioms", "Kitchen Sink",
        "Names", "NYT Crosswords", "Places", "UK advanced cryptics", "Websters New Intl"
    ];
    Program.customWordLists = [];
    return Program;
}());
//# sourceMappingURL=app.js.map