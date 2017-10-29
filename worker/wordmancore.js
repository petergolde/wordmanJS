"use strict";
var WordList = (function () {
    function WordList(sanitizedWordList) {
        this.words = sanitizedWordList;
    }
    WordList.create = function (wordFile, sanitize) {
        var newList = [];
        var lines = wordFile.split("\r\n");
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            if (sanitize) {
                line = this.sanitize(line);
            }
            newList.push(line);
        }
        if (sanitize) {
            newList = newList.sort();
        }
        return new WordList(newList);
    };
    WordList.merge = function (listsToMerge) {
        var indices = [];
        for (var i = 0; i < listsToMerge.length; ++i) {
            indices[i] = 0;
        }
        var newList = [];
        for (;;) {
            var word = null;
            for (var i = 0; i < listsToMerge.length; ++i) {
                var newWord = null;
                if (indices[i] < listsToMerge[i].count())
                    newWord = listsToMerge[i].words[indices[i]];
                if (newWord !== null && (word === null || newWord < word))
                    word = newWord;
            }
            if (word === null)
                break;
            newList.push(word);
            for (var i = 0; i < listsToMerge.length; ++i) {
                if (indices[i] < listsToMerge[i].count() && word === listsToMerge[i].words[indices[i]])
                    ++indices[i];
            }
        }
        return new WordList(newList);
    };
    WordList.prototype.count = function () {
        return this.words.length;
    };
    WordList.sanitize = function (line) {
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
            if ((options.minLength !== undefined && options.minLength > 0 && len < options.minLength) ||
                (options.maxLength !== undefined && options.maxLength > 0 && len > options.maxLength))
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
    MatchDriver.ordinalFromLetter = function (letter) {
        var code = letter.toUpperCase().charCodeAt(0);
        if (code < WordList.aCodePoint || code > WordList.zCodePoint) {
            throw new Error("bad letter");
        }
        return code - WordList.aCodePoint;
    };
    MatchDriver.letterFromOrdinalf = function (ordinal) {
        return String.fromCharCode(ordinal + WordList.aCodePoint);
    };
    MatchDriver.maskFrom0to25 = function (i) {
        if (i < 0 || i > 25) {
            throw new Error("Bad letter index");
        }
        return 1 << i;
    };
    MatchDriver.maskFromLetter = function (letter) {
        return this.maskFrom0to25(this.ordinalFromLetter(letter));
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
        this.regexList = [regex];
        if (mistakes == 1) {
            for (var mistakePosition = 0; mistakePosition < this.minLength; ++mistakePosition) {
                regexResult = this.translateToRegex(query, mistakePosition);
                this.regexList.push(regexResult.regex);
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
var Anagram = (function () {
    function Anagram() {
        this.literals = [];
        this.classes = [];
        this.letterCount = [];
    }
    Anagram.prototype.toString = function () {
        return "Anagram";
    };
    Anagram.prototype.reverseMeaningful = function () { return false; };
    Anagram.prototype.maxMistakes = function () { return 5; };
    Anagram.prototype.help = function () {
        return "Type letters to anagram.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    };
    Anagram.prototype.setPattern = function (pattern, mistakes) {
        var query = MatchDriver.parseQueryText(pattern);
        this.countQMark = 0;
        this.minLength = 0;
        this.mistakes = mistakes;
        this.hasStar = false;
        this.classes = [];
        for (var i = 0; i < 26; ++i) {
            this.literals[i] = 0;
        }
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind == QueryElementKind.Letter) {
                this.literals[MatchDriver.ordinalFromLetter(el.letter)] += 1;
                this.minLength += 1;
            }
            else if (el.kind == QueryElementKind.Wild) {
                this.countQMark += 1;
                this.minLength += 1;
            }
            else if (el.kind == QueryElementKind.Star) {
                this.hasStar = true;
            }
            else if (el.kind == QueryElementKind.MultiLetter) {
                this.classes.push(el.classArray);
                this.minLength += 1;
            }
            else {
                throw new Error("Unexpected query element");
            }
        }
    };
    Anagram.prototype.countLetters = function (word) {
        for (var i = 0; i < 26; ++i)
            this.letterCount[i] = 0;
        for (var i = 0; i < word.length; ++i) {
            this.letterCount[MatchDriver.ordinalFromLetter(word.charAt(i))] += 1;
        }
    };
    Anagram.prototype.matchWildcards = function (mistakesLeft) {
        var remaining = 0;
        for (var c = 0; c < 26; ++c) {
            remaining += this.letterCount[c];
        }
        remaining -= (this.mistakes - mistakesLeft);
        if (this.hasStar) {
            if (remaining < this.countQMark)
                throw new Error("Letter count is goofed up somehow!");
        }
        else {
            if (remaining !== this.countQMark)
                throw new Error("Letter count is goofed up somehow!");
        }
        return true;
    };
    Anagram.prototype.matchClasses = function (startIndex, mistakesLeft) {
        if (this.classes.length > startIndex) {
            var charClass = this.classes[startIndex];
            for (var i = 0; i < 26; ++i) {
                if (charClass[i] && this.letterCount[i] >= 1) {
                    --this.letterCount[i];
                    if (this.matchClasses(startIndex + 1, mistakesLeft))
                        return true;
                    ++this.letterCount[i];
                }
            }
            if (mistakesLeft > 0) {
                if (this.matchClasses(startIndex + 1, mistakesLeft - 1))
                    return true;
            }
            return false;
        }
        else {
            return this.matchWildcards(mistakesLeft);
        }
    };
    Anagram.prototype.matchLiterals = function (mistakesLeft) {
        for (var c = 0; c < 26; ++c) {
            if (this.literals[c] > 0) {
                if (this.letterCount[c] < this.literals[c]) {
                    if (mistakesLeft < this.literals[c] - this.letterCount[c]) {
                        return false;
                    }
                    else {
                        mistakesLeft -= this.literals[c] - this.letterCount[c];
                        this.letterCount[c] = 0;
                    }
                }
                else {
                    this.letterCount[c] -= this.literals[c];
                }
            }
        }
        return this.matchClasses(0, mistakesLeft);
    };
    Anagram.prototype.matchWord = function (word) {
        var length = word.length;
        if (length < this.minLength)
            return false;
        if (!this.hasStar && length > this.minLength)
            return false;
        this.countLetters(word);
        return this.matchLiterals(this.mistakes);
    };
    return Anagram;
}());
var Build = (function () {
    function Build() {
        this.literals = [];
        this.classes = [];
        this.letterCount = [];
    }
    Build.prototype.toString = function () {
        return "Build";
    };
    Build.prototype.reverseMeaningful = function () { return false; };
    Build.prototype.maxMistakes = function () { return 5; };
    Build.prototype.help = function () {
        return "Type letters to build word from.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c";
    };
    Build.prototype.setPattern = function (pattern, mistakes) {
        var query = MatchDriver.parseQueryText(pattern);
        this.classes = [];
        this.countQMark = 0;
        this.maxLength = 0;
        for (var i = 0; i < this.literals.length; ++i) {
            this.literals[i] = 0;
        }
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind === QueryElementKind.Letter) {
                this.literals[MatchDriver.ordinalFromLetter(el.letter)] += 1;
                this.maxLength += 1;
            }
            else if (el.kind === QueryElementKind.Wild) {
                this.countQMark += 1;
                this.maxLength += 1;
            }
            else if (el.kind == QueryElementKind.Star) {
                throw new Error("* or @ cannot appear in a build");
            }
            else if (el.kind == QueryElementKind.MultiLetter) {
                this.classes.push(el.classArray);
                this.maxLength += 1;
            }
            else {
                throw new Error("Unexpected pattern element kind");
            }
        }
        this.countQMark += mistakes;
    };
    Build.prototype.countLetters = function (word) {
        for (var i = 0; i < 26; ++i) {
            this.letterCount[i] = 0;
        }
        for (var i = 0; i < word.length; ++i) {
            this.letterCount[MatchDriver.ordinalFromLetter(word[i])] += 1;
        }
    };
    Build.prototype.matchWildcards = function () {
        var remaining = 0;
        for (var c = 0; c < 26; ++c)
            if (this.letterCount[c] > 0)
                remaining += this.letterCount[c];
        if (remaining > this.countQMark)
            return false;
        return true;
    };
    Build.prototype.matchClasses = function (startIndex) {
        if (this.classes.length > startIndex) {
            var charClass = this.classes[startIndex];
            if (this.matchClasses(startIndex + 1))
                return true;
            for (var i = 0; i < 26; ++i) {
                if (charClass[i] && this.letterCount[i] > 0) {
                    --this.letterCount[i];
                    if (this.matchClasses(startIndex + 1))
                        return true;
                    ++this.letterCount[i];
                }
            }
            return false;
        }
        else {
            return this.matchWildcards();
        }
    };
    Build.prototype.matchLiterals = function () {
        for (var c = 0; c < 26; ++c) {
            if (this.literals[c] > 0) {
                this.letterCount[c] -= this.literals[c];
            }
        }
        return this.matchClasses(0);
    };
    Build.prototype.matchWord = function (word) {
        var length = word.length;
        if (length > this.maxLength)
            return false;
        this.countLetters(word);
        return this.matchLiterals();
    };
    return Build;
}());
var CryptoMatch = (function () {
    function CryptoMatch() {
    }
    CryptoMatch.prototype.toString = function () {
        return "Cryptogram";
    };
    CryptoMatch.prototype.reverseMeaningful = function () { return true; };
    CryptoMatch.prototype.maxMistakes = function () { return 0; };
    CryptoMatch.prototype.help = function () {
        return "Type a cryptogram pattern.\r\n(example: XYZZY matches PENNE)\r\n\r\n?\tmatches any letter\r\n*\tmatches zero or more letters";
    };
    CryptoMatch.prototype.translateToRegex = function (pattern) {
        var query = MatchDriver.parseQueryText(pattern);
        var builder = "";
        var charsUsedSoFar = "";
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind === QueryElementKind.Letter) {
                var c = el.letter;
                if (charsUsedSoFar.indexOf(c) >= 0) {
                    builder += "\\k<";
                    builder += c;
                    builder += ">";
                }
                else {
                    builder += "(?<";
                    builder += c;
                    builder + ">";
                    if (charsUsedSoFar !== "") {
                        builder += "(?!";
                        for (var j = 0; j < charsUsedSoFar.length; ++j) {
                            if (j !== 0)
                                builder += "|";
                            builder += "\\k<";
                            builder += charsUsedSoFar[j];
                            builder += ">";
                        }
                        builder += ")";
                    }
                    builder += ".";
                    builder += ")";
                    charsUsedSoFar = charsUsedSoFar + c;
                }
            }
            else if (el.kind == QueryElementKind.Wild) {
                builder += ".";
            }
            else if (el.kind == QueryElementKind.Star) {
                builder += ".*";
            }
            else if (el.kind == QueryElementKind.MultiLetter) {
                throw new Error("[] not supported in crypto-pattern");
            }
            else {
                throw new Error("Unexpected query element");
            }
        }
        return builder;
    };
    CryptoMatch.prototype.setPattern = function (pattern, mistakes) {
        var regexExpression = this.translateToRegex(pattern);
        this.regex = new RegExp("^" + regexExpression + "$");
    };
    CryptoMatch.prototype.matchWord = function (word) {
        return this.regex.test(word);
    };
    return CryptoMatch;
}());
var Subword = (function () {
    function Subword() {
        this.wordMasks = [];
    }
    Subword.prototype.toString = function () {
        return "Subword";
    };
    Subword.prototype.reverseMeaningful = function () { return true; };
    Subword.prototype.maxMistakes = function () { return 5; };
    Subword.prototype.shelp = function () {
        return "Type pattern to find subwords.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n";
    };
    Subword.prototype.setPattern = function (pattern, mistakes) {
        var query = MatchDriver.parseQueryText(pattern);
        var maskList = [];
        this.maxLength = 0;
        this.mistakes = mistakes;
        for (var i = 0; i < query.length; ++i) {
            var el = query[i];
            if (el.kind == QueryElementKind.Star) {
                throw new Error("'*' or '@' is not permitted in a subword");
            }
            else {
                maskList.push(el.mask);
                ++this.maxLength;
            }
        }
        this.patternMasks = maskList;
        if (this.maxLength !== this.patternMasks.length)
            throw new Error("Huh?");
    };
    Subword.prototype.encodeWord = function (word) {
        this.wordLength = word.length;
        for (var i = 0; i < this.wordLength; ++i) {
            this.wordMasks[i] = MatchDriver.maskFromLetter(word[i]);
        }
    };
    Subword.prototype.matchesAt = function (index) {
        var mistakesLeft = this.mistakes;
        for (var i = 0; i < this.wordLength; ++i) {
            if ((this.wordMasks[i] & this.patternMasks[i + index]) == 0) {
                if (mistakesLeft > 0)
                    mistakesLeft -= 1;
                else
                    return false;
            }
        }
        return true;
    };
    Subword.prototype.matchWord = function (word) {
        if (word.length > this.maxLength)
            return false;
        this.encodeWord(word);
        for (var index = 0; index <= this.maxLength - this.wordLength; ++index) {
            if (this.matchesAt(index))
                return true;
        }
        return false;
    };
    return Subword;
}());
//# sourceMappingURL=wordmancore.js.map