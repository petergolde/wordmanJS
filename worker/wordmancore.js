"use strict";
var WordList = (function () {
    function WordList(wordFile) {
        this.words = [];
        var lines = wordFile.split("\n");
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var sanitized = this.sanitize(line);
            this.words.push(sanitized);
        }
    }
    WordList.prototype.count = function () {
        return this.words.length;
    };
    WordList.prototype.sanitize = function (line) {
        var result = "";
        for (var i = 0; i < line.length; ++i) {
            var ch = line.charAt(i).toUpperCase();
            var code = ch.charCodeAt(0);
            if (code >= WordList.aCodePoint && code <= WordList.zCodePoint) {
                result = result + ch;
            }
        }
        return result;
    };
    WordList.aCodePoint = "A".charCodeAt(0);
    WordList.zCodePoint = "Z".charCodeAt(0);
    return WordList;
}());
var QueryElementKind;
(function (QueryElementKind) {
    QueryElementKind[QueryElementKind["Letter"] = 0] = "Letter";
    QueryElementKind[QueryElementKind["Wild"] = 1] = "Wild";
    QueryElementKind[QueryElementKind["Star"] = 2] = "Star";
    QueryElementKind[QueryElementKind["MultiLetter"] = 3] = "MultiLetter";
})(QueryElementKind || (QueryElementKind = {}));
;
var QueryElement = (function () {
    function QueryElement(kind, data) {
        this.kind = kind;
        switch (kind) {
            case QueryElementKind.Letter:
                if (typeof data === "string") {
                    this.letter = data;
                    this.mask = MatchDriver.maskFromLetter(this.letter);
                }
                else {
                    throw new Error("bad kind");
                }
                break;
            case QueryElementKind.MultiLetter:
                if (typeof data === "object") {
                    this.classArray = data;
                    this.mask = MatchDriver.maskFromArray(this.classArray);
                }
                else {
                    throw new Error("bad kind");
                }
            case QueryElementKind.Star:
                break;
            case QueryElementKind.Wild:
                this.mask = MatchDriver.maskFromWildcard();
                break;
        }
    }
    return QueryElement;
}());
var MatchDriver = (function () {
    function MatchDriver() {
    }
    MatchDriver.findMatches = function (matcher, wordList, pattern, options) {
        var hitMax = false;
        var wordlist = wordList.words;
        var output = [];
        if (options.maxReturn)
            matcher.setPattern(pattern, (options.mistakes === undefined) ? 0 : options.mistakes);
        for (var _i = 0, wordlist_1 = wordlist; _i < wordlist_1.length; _i++) {
            var word = wordlist_1[_i];
            var pat = word;
            var len = pat.length;
            if ((options.minLength !== undefined && len < options.minLength) || (options.maxLength != undefined && len > options.maxLength))
                continue;
            if (options.reverse) {
                pat = this.reverseString(pat);
            }
            if (matcher.matchWord(pat)) {
                if (output.length >= ((options.maxReturn === undefined) ? 10000 : options.maxReturn)) {
                    hitMax = true;
                    break;
                }
                else {
                    output.push(word);
                }
            }
        }
        return { matches: output, hitMaximum: hitMax };
    };
    MatchDriver.reverseString = function (s) {
        return s.split("").reverse().join("");
    };
    MatchDriver.parseQueryText = function (pattern) {
        var elements = [];
        for (var i = 0; i < pattern.length; ++i) {
            var c = pattern.charAt(i).toUpperCase();
            if ((c >= 'A' && c <= 'Z')) {
                elements.push(new QueryElement(QueryElementKind.Letter, c));
            }
            else if (c === '?' || c === '.') {
                elements.push(new QueryElement(QueryElementKind.Wild));
            }
            else if (c === '*' || c === '@') {
                elements.push(new QueryElement(QueryElementKind.Star));
            }
            else if (c === '[' || c === '(') {
                var bracketResult = MatchDriver.parseBracketed(pattern, i);
                i = bracketResult.endIndex;
                elements.push(new QueryElement(QueryElementKind.MultiLetter, bracketResult.letterArray));
            }
            else if (c === ']') {
                throw new Error("] is missing a [");
            }
            else if (c === ')') {
                throw new Error(") is missing a (");
            }
            else {
                throw new Error("'" + c + "' is not a valid character");
            }
        }
        return elements;
    };
    MatchDriver.parseBracketed = function (pattern, startIndex) {
        var index = startIndex;
        if (pattern.charAt(index) !== '[' && pattern.charAt(index) !== '(') {
            throw new Error("Bracketed section must start with [ or (");
        }
        var inverse = false;
        var bracketed = [];
        var c = "\0";
        ++index;
        while (index < pattern.length) {
            c = pattern.charAt(index).toUpperCase();
            if (c === '^' || c === '!') {
                if (index != startIndex + 1)
                    throw new Error("^ or ! must appear as first character of a bracketed section");
                inverse = true;
            }
            else if (c >= 'A' && c <= 'Z') {
                bracketed[c.charCodeAt(0) - 'A'.charCodeAt(0)] = true;
            }
            else if (c == ']' || c == ')') {
                break;
            }
            else {
                throw new Error("'" + c + "' is not valid inside brackets");
            }
            ++index;
        }
        if (c !== ']' && c !== ')')
            throw new Error("[ is missing a ]");
        if (inverse) {
            for (var i = 0; i < 26; ++i)
                bracketed[i] = !bracketed[i];
        }
        return { letterArray: bracketed, endIndex: index };
    };
    MatchDriver.maskFrom0to25 = function (i) {
        if (i < 0 || i > 25) {
            throw new Error("Bad letter index");
        }
        return 1 << i;
    };
    MatchDriver.maskFromLetter = function (letter) {
        var code = letter.toUpperCase().charCodeAt(0);
        if (code < WordList.aCodePoint || code > WordList.zCodePoint) {
            throw new Error("bad letter");
        }
        return this.maskFrom0to25(code - WordList.aCodePoint);
    };
    MatchDriver.maskFromWildcard = function () {
        return (1 << 26) - 1;
    };
    MatchDriver.maskFromArray = function (array) {
        var mask = 0;
        for (var i = 0; i <= 25; ++i) {
            if (array[i])
                mask |= this.maskFrom0to25(i);
        }
        return mask;
    };
    return MatchDriver;
}());
var Pattern = (function () {
    function Pattern(isSuperWord) {
        this.wordMasks = [];
        this.isSuperWord = isSuperWord;
    }
    Pattern.prototype.toString = function () {
        return this.isSuperWord ? "Superword" : "Pattern";
    };
    Pattern.prototype.reverseMeaningful = function () {
        return true;
    };
    Pattern.prototype.maxMistakes = function () {
        if (this.isSuperWord)
            return 1;
        else
            return 5;
    };
    Pattern.prototype.help = function () {
        return (this.isSuperWord ? "Type a pattern to find superwords of.\r\n\r\n" : "Type a pattern to match, in order.\r\n\r\n") +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    };
    Pattern.prototype.translateToRegex = function (query, mistakePosition) {
        var builder = "";
        var hasStar = false;
        var nonStarsFound = 0;
        builder += '^';
        if (this.isSuperWord) {
            hasStar = true;
            builder += ".*";
        }
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind == QueryElementKind.Letter) {
                if (nonStarsFound == mistakePosition)
                    builder += '.';
                else
                    builder += el.letter;
                nonStarsFound += 1;
            }
            else if (el.kind == QueryElementKind.Wild) {
                builder += ".";
                nonStarsFound += 1;
            }
            else if (el.kind == QueryElementKind.Star) {
                builder += ".*";
                hasStar = true;
            }
            else if (el.kind == QueryElementKind.MultiLetter) {
                if (nonStarsFound == mistakePosition) {
                    builder += '.';
                    nonStarsFound += 1;
                }
                else {
                    builder += "[";
                    for (var code = WordList.aCodePoint; code <= WordList.zCodePoint; ++code) {
                        var c = String.fromCharCode(code);
                        if ((el.mask & MatchDriver.maskFromLetter(c)) != 0) {
                            builder += c;
                        }
                    }
                    builder += "]";
                }
                nonStarsFound += 1;
            }
            else {
                throw new Error("unexpected QueryElementKind");
            }
        }
        if (this.isSuperWord)
            builder += ".*";
        builder += '$';
        return { regex: new RegExp(builder), nonStarsFound: nonStarsFound, hasStar: hasStar };
    };
    Pattern.prototype.setupRegexMethod = function (query, mistakes) {
        var regexResult = this.translateToRegex(query, -1);
        this.usingRegex = true;
        this.hasStar = regexResult.hasStar;
        this.minLength = regexResult.nonStarsFound;
        var regex = regexResult.regex;
        var regexList;
        regexList = [regex];
        if (mistakes == 1) {
            for (var mistakePosition = 0; mistakePosition < this.minLength; ++mistakePosition) {
                regexResult = this.translateToRegex(query, mistakePosition);
                regexList.push(regexResult.regex);
            }
        }
        else if (mistakes != 0) {
            throw new Error("Can not have more than 1 mistake!");
        }
    };
    Pattern.prototype.setupMaskMethod = function (query, mistakes) {
        this.usingRegex = false;
        this.hasStar = false;
        this.mistakes = mistakes;
        this.minLength = query.length;
        var maskList = [];
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind == QueryElementKind.Star)
                throw new Error("Cannot use '*' or '@' in this query");
            maskList.push(el.mask);
        }
        if (this.minLength != maskList.length)
            throw new Error("Huh?");
        this.patternMasks = maskList;
    };
    Pattern.prototype.setPattern = function (pattern, mistakes) {
        var query = MatchDriver.parseQueryText(pattern);
        this.hasStar = false;
        this.mistakes = mistakes;
        for (var _i = 0, query_1 = query; _i < query_1.length; _i++) {
            var el = query_1[_i];
            if (el.kind == QueryElementKind.Star)
                this.hasStar = true;
        }
        if (this.isSuperWord || this.hasStar) {
            if (mistakes > 1) {
                throw new Error("Cannot set more than one mistake if the pattern contains a '*' or '@'.");
            }
            this.setupRegexMethod(query, mistakes);
        }
        else {
            this.setupMaskMethod(query, mistakes);
        }
    };
    Pattern.prototype.encodeWord = function (word) {
        this.wordLength = word.length;
        for (var i = 0; i < this.wordLength; ++i) {
            this.wordMasks[i] = MatchDriver.maskFromLetter(word[i]);
        }
    };
    Pattern.prototype.matchWord = function (word) {
        var length = word.length;
        if (length < this.minLength)
            return false;
        if (!this.hasStar && length > this.minLength)
            return false;
        if (this.usingRegex) {
            for (var _i = 0, _a = this.regexList; _i < _a.length; _i++) {
                var regex = _a[_i];
                if (regex.exec(word))
                    return true;
            }
            return false;
        }
        else {
            this.encodeWord(word);
            var mistakesLeft = this.mistakes;
            for (var i = 0; i < this.wordLength; ++i) {
                if ((this.wordMasks[i] & this.patternMasks[i]) == 0) {
                    if (mistakesLeft > 0)
                        mistakesLeft -= 1;
                    else
                        return false;
                }
            }
            return true;
        }
    };
    return Pattern;
}());
//# sourceMappingURL=wordmancore.js.map