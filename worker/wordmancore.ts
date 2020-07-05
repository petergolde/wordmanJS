
class WordList {
    public words: string[];
    public static aCodePoint: number = "A".charCodeAt(0);
    public static zCodePoint: number = "Z".charCodeAt(0);

    private constructor(sanitizedWordList: string[]) {
        this.words = sanitizedWordList;
    }

    public static create(wordFile: string, sanitize: boolean): WordList {
        let newList = [];
        let lines: string[] = wordFile.split("\n");
        for (let line of lines) {
            if (sanitize) {
                line = this.sanitize(line);
            }
            else if (line.endsWith('\r')) {
                line = line.substr(0, line.length - 1);
            }
            if (line.length > 0) {
                newList.push(line);
            }
        }

        if (sanitize) {
            newList = newList.sort();
        }

        return new WordList(newList);
    }

    public static createFromArray(wordArray: string[], sanitize: boolean): WordList {
        let newList = [];
        for (let line of wordArray) {
            if (sanitize) {
                line = this.sanitize(line);
            }
            if (line.length > 0) {
                newList.push(line);
            }
        }

        if (sanitize) {
            newList = newList.sort();
        }

        return new WordList(newList);
    }

    public static merge(listsToMerge: WordList[]) {
        let indices: number[] = [];
        for (let i = 0; i < listsToMerge.length; ++i) {
            indices[i] = 0;
        }

        let newList: string[] = [];
        for (; ;) {
            // Are there any words left?
            // Find the smallest word.
            let word: string | null = null;
            for (let i = 0; i < listsToMerge.length; ++i) {
                let newWord: string | null = null;
                if (indices[i] < listsToMerge[i].count())
                    newWord = listsToMerge[i].words[indices[i]];
                if (newWord !== null && (word === null || newWord < word))
                    word = newWord;
            }

            if (word === null)
                break;			//Done.

            // Add to the merged list.
            newList.push(word);

            // Advance indices.
            for (let i = 0; i < listsToMerge.length; ++i) {
                if (indices[i] < listsToMerge[i].count() && word === listsToMerge[i].words[indices[i]])
                    ++indices[i];
            }
        }

        return new WordList(newList);
    }

    public count(): number {
        return this.words.length;
    }

    private static sanitize(line: string): string {
        let result: string = "";
        for (var i: number = 0; i < line.length; ++i) {
            let ch: string = line.charAt(i).toUpperCase();
            let code: number = ch.charCodeAt(0);
            if (code >= WordList.aCodePoint && code <= WordList.zCodePoint) {
                result = result + ch;
            }
        }
        return result;
    }
}

interface IMatcher {
    setPattern(pattern: string, mistakes: number): void;
    matchWord(word: string): boolean;
}

enum QueryElementKind { Letter, Wild, Star, MultiLetter };

class QueryElement {
    public readonly kind: QueryElementKind;
    public readonly letter: string;
    public readonly mask: number;
    public readonly classArray: boolean[];

    public constructor(kind: QueryElementKind, data?: (string | boolean[])) {
        this.kind = kind;
        this.letter = "";
        this.mask = 0;
        this.classArray = [];

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
}

interface MatchResult {
    matches: string[];
    hitMaximum: boolean;
}

interface MatchOptions {
    reverse?: boolean;
    mistakes?: number;
    minLength?: number;
    maxLength?: number;
    maxReturn?: number;
}

class MatchDriver {
    public static findMatches(matcher: IMatcher, wordList: WordList, pattern: string, options: MatchOptions): MatchResult {
        let hitMax = false;
        let wordlist = wordList.words;
        let output: string[] = [];

        if (options.maxReturn)

            matcher.setPattern(pattern, (options.mistakes === undefined) ? 0 : options.mistakes);

        for (let word of wordlist) {
            let pat = word;
            let len = pat.length;
            if ((options.minLength !== undefined && options.minLength > 0 && len < options.minLength) ||
                (options.maxLength !== undefined && options.maxLength > 0 && len > options.maxLength))
                continue;

            if (options.reverse) {
                // Reverse the word.
                pat = this.reverseString(pat);
            }

            if (matcher.matchWord(pat)) {
                if (output.length >= ((options.maxReturn === undefined) ? 10000 : options.maxReturn)) {
                    hitMax = true;
                    break;
                }
                else {
                    output.push(word);		// Add the original, before reversing!
                }
            }
        }

        return { matches: output, hitMaximum: hitMax };
    }

    public static reverseString(s: string): string {
        return s.split("").reverse().join("");
    }

    public static parseQueryText(pattern: string): QueryElement[] {
        let elements: QueryElement[] = [];

        for (let i = 0; i < pattern.length; ++i) {
            let c = pattern.charAt(i).toUpperCase();

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
                let bracketResult = MatchDriver.parseBracketed(pattern, i);
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
                throw new Error(`'${c}' is not a valid character`);
            }
        }

        return elements;
    }

    public static parseBracketed(pattern: string, startIndex: number): { letterArray: boolean[]; endIndex: number } {
        let index = startIndex;
        if (pattern.charAt(index) !== '[' && pattern.charAt(index) !== '(') {
            throw new Error("Bracketed section must start with [ or (");
        }
        let inverse = false;
        let bracketed: boolean[] = [];
        let c = "\0";

        ++index;
        while (index < pattern.length) {
            c = pattern.charAt(index).toUpperCase();
            if (c === '^' || c === '!') {
                if (index != startIndex + 1)
                    throw new Error("^ or ! must appear as first character of a bracketed section");
                inverse = true;
            }
            else if (c >= 'A' && c <= 'Z') {
                bracketed[<number>c.charCodeAt(0) - <number>'A'.charCodeAt(0)] = true;
            }
            else if (c == ']' || c == ')') {
                break;
            }
            else {
                throw new Error(`'${c}' is not valid inside brackets`);
            }

            ++index;
        }

        if (c !== ']' && c !== ')')
            throw new Error("[ is missing a ]");

        if (inverse) {
            for (let i = 0; i < 26; ++i)
                bracketed[i] = !bracketed[i];
        }

        return { letterArray: bracketed, endIndex: index };
    }

    public static ordinalFromLetter(letter: string): number {
        let code = <number>letter.toUpperCase().charCodeAt(0);
        if (code < WordList.aCodePoint || code > WordList.zCodePoint) {
            throw new Error("bad letter");
        }

        return code - WordList.aCodePoint;
    }

    public static letterFromOrdinal(ordinal: number): string {
        return String.fromCharCode(ordinal + WordList.aCodePoint);
    }

    public static maskFrom0to25(i: number): number {
        if (i < 0 || i > 25) {
            throw new Error("Bad letter index");
        }

        return 1 << i;
    }

    public static maskFromLetter(letter: string): number {
        return this.maskFrom0to25(this.ordinalFromLetter(letter));
    }

    public static maskFromWildcard(): number {
        return (1 << 26) - 1;
    }

    public static maskFromArray(array: boolean[]): number {
        let mask: number = 0;

        for (var i = 0; i <= 25; ++i) {
            if (array[i])
                mask |= this.maskFrom0to25(i);
        }

        return mask;
    }
}

class Pattern implements IMatcher {
    private isSuperWord: boolean;	// Pattern or superword?

    private usingRegex: boolean = false;			// If true, using the regex method

    // Variables to store the pattern using the regex method
    private regexList: RegExp[] = [];
    private minLength: number = 0;
    private hasStar: boolean = false;

    // Variables to stort the pattern using the mask method
    // Encoding of the pattern.
    private patternMasks: number[] = [];

    // Number of allowed mistakes
    private mistakes: number = 0;

    // Temp array for encoding the current word (to avoid lots of allocation/deallocations).
    private wordMasks: number[] = [];
    private wordLength: number = 0;

    public constructor(isSuperWord: boolean) {
        this.isSuperWord = isSuperWord;
    }

    public toString(): string {
        return this.isSuperWord ? "Superword" : "Pattern";
    }

    public reverseMeaningful(): boolean {
        return true;
    }

    public maxMistakes(): number {
        if (this.isSuperWord)
            return 1;
        else
            return 5;
    }

    public help(): string {
        return (this.isSuperWord ? "Type a pattern to find superwords of.\r\n\r\n" : "Type a pattern to match, in order.\r\n\r\n") +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    }

    private translateToRegex(query: QueryElement[], mistakePosition: number): { regex: RegExp, nonStarsFound: number, hasStar: boolean } {
        let builder: string = "";

        let hasStar = false;
        let nonStarsFound = 0;

        builder += '^';
        if (this.isSuperWord) {
            hasStar = true;
            builder += ".*";
        }

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

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
                    for (let code = WordList.aCodePoint; code <= WordList.zCodePoint; ++code) {
                        let c = String.fromCharCode(code);
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
    }

    private setupRegexMethod(query: QueryElement[], mistakes: number): void {
        let regexResult = this.translateToRegex(query, -1);
        this.usingRegex = true;
        this.hasStar = regexResult.hasStar;
        this.minLength = regexResult.nonStarsFound;

        let regex = regexResult.regex;
        this.regexList = [regex];

        if (mistakes == 1) {
            // Create a regex for correct, and for each possible mistake position.
            for (let mistakePosition = 0; mistakePosition < this.minLength; ++mistakePosition) {
                regexResult = this.translateToRegex(query, mistakePosition);
                this.regexList.push(regexResult.regex);
            }
        }
        else if (mistakes != 0) {
            throw new Error("Can not have more than 1 mistake!");
        }
    }

    private setupMaskMethod(query: QueryElement[], mistakes: number): void {
        this.usingRegex = false;
        this.hasStar = false;
        this.mistakes = mistakes;
        this.minLength = query.length;

        let maskList: number[] = [];

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];
            if (el.kind == QueryElementKind.Star)
                throw new Error("Cannot use '*' or '@' in this query");

            maskList.push(el.mask);
        }

        if (this.minLength != maskList.length)
            throw new Error("Huh?");

        this.patternMasks = maskList;
    }

    public setPattern(pattern: string, mistakes: number): void {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        this.hasStar = false;
        this.mistakes = mistakes;
        for (let el of query) {
            if (el.kind == QueryElementKind.Star)
                this.hasStar = true;
        }

        if (this.isSuperWord || this.hasStar) {
            // If we have multi-letter wild-card, must use the regex method, which is limited
            // to one mistake.
            if (mistakes > 1) {
                throw new Error("Cannot set more than one mistake if the pattern contains a '*' or '@'.");
            }

            this.setupRegexMethod(query, mistakes);
        }
        else {
            this.setupMaskMethod(query, mistakes);
        }
    }

    private encodeWord(word: string): void {
        this.wordLength = word.length;
        for (let i = 0; i < this.wordLength; ++i) {
            this.wordMasks[i] = MatchDriver.maskFromLetter(word[i]);
        }
    }

    public matchWord(word: string): boolean {
        let length = word.length;
        if (length < this.minLength)
            return false;
        if (!this.hasStar && length > this.minLength)
            return false;

        if (this.usingRegex) {
            for (let regex of this.regexList) {
                if (regex.exec(word))
                    return true;
            }

            return false;
        }
        else {
            this.encodeWord(word);

            let mistakesLeft = this.mistakes;
            for (let i = 0; i < this.wordLength; ++i) {
                if ((this.wordMasks[i] & this.patternMasks[i]) == 0) {
                    if (mistakesLeft > 0)
                        mistakesLeft -= 1;
                    else
                        return false;
                }
            }

            return true;

        }
    }
}

class Anagram implements IMatcher {
    // Encoding of the pattern.
    private hasStar: boolean = false;			// is a star in the pattern?
    private countQMark: number = 0;			// number of '?' in pattern
    private mistakes: number = 0;			// number of allowed mistakes
    private minLength: number = 0;					// minimum length of matching word
    private literals: number[] = [];				// count of number of each literal letter in pattern.
    private classes: boolean[][] = [];		// character classes, contains bool[26].

    // Temp array for encoding the current word (to avoid lots of allocation/deallocations.
    private letterCount: number[] = [];

    public toString(): string {
        return "Anagram";
    }

    public reverseMeaningful() { return false; }

    public maxMistakes() { return 5; }

    public help() {
        return "Type letters to anagram.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    }

    public setPattern(pattern: string, mistakes: number): void {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        this.countQMark = 0;
        this.minLength = 0;
        this.mistakes = mistakes;
        this.hasStar = false;
        this.classes = [];

        for (let i = 0; i < 26; ++i) {
            this.literals[i] = 0;
        }

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

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
    }

    private countLetters(word: string): void {
        for (let i = 0; i < 26; ++i)
            this.letterCount[i] = 0;
        for (let i = 0; i < word.length; ++i) {
            this.letterCount[MatchDriver.ordinalFromLetter(word.charAt(i))] += 1;
        }
    }

    public matchWildcards(mistakesLeft: number): boolean {
        // Count the remaining letters.
        let remaining = 0;
        for (let c = 0; c < 26; ++c) {
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
    }

    public matchClasses(startIndex: number, mistakesLeft: number): boolean {
        if (this.classes.length > startIndex) {
            // Match the first character class; use recursion to do the rest
            let charClass: boolean[] = this.classes[startIndex];

            for (let i = 0; i < 26; ++i) {
                if (charClass[i] && this.letterCount[i] >= 1) {
                    // possible match. Recursively check.
                    --this.letterCount[i];
                    if (this.matchClasses(startIndex + 1, mistakesLeft))
                        return true;
                    ++this.letterCount[i];
                }
            }
            if (mistakesLeft > 0) {
                // Possibly matches a mistake. Recursively check.
                if (this.matchClasses(startIndex + 1, mistakesLeft - 1))
                    return true;
            }
            return false;
        }
        else {
            return this.matchWildcards(mistakesLeft);
        }
    }

    public matchLiterals(mistakesLeft: number): boolean {
        // Match up all the literals.
        for (let c = 0; c < 26; ++c) {
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
    }

    public matchWord(word: string): boolean {
        let length = word.length;
        if (length < this.minLength)
            return false;
        if (!this.hasStar && length > this.minLength)
            return false;

        this.countLetters(word);

        return this.matchLiterals(this.mistakes);
    }
}

class Build implements IMatcher {
    // Encoding of the pattern.
    private countQMark: number = 0;			// number of '?' in pattern
    private maxLength: number = 0;					// max length of matching word
    private literals: number[] = [];				// count of number of each literal letter in pattern.
    private classes: boolean[][] = [];		// character classes, contains bool[26].

    // Temp array for encoding the current word (to avoid lots of allocation/deallocations.
    private letterCount: number[] = [];

    public toString(): string {
        return "Build";
    }

    public reverseMeaningful(): boolean { return false; }

    public maxMistakes(): number { return 5; }

    public help(): string {
        return "Type letters to build word from.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c";
    }

    public setPattern(pattern: string, mistakes: number): void {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        this.classes = [];
        this.countQMark = 0;
        this.maxLength = 0;
        for (let i = 0; i < 26; ++i) {
            this.literals[i] = 0;
        }
        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

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

        // Mistakes are just equivalent to extra question-marks.
        this.countQMark += mistakes;
    }

    private countLetters(word: string): void {
        for (let i = 0; i < 26; ++i) {
            this.letterCount[i] = 0;
        }
        for (let i = 0; i < word.length; ++i) {
            this.letterCount[MatchDriver.ordinalFromLetter(word[i])] += 1;
        }
    }

    public matchWildcards(): boolean {
        // Count the remaining letters.
        let remaining = 0;
        for (let c = 0; c < 26; ++c)
            if (this.letterCount[c] > 0)
                remaining += this.letterCount[c];

        if (remaining > this.countQMark)
            return false;

        return true;
    }

    public matchClasses(startIndex: number): boolean {
        if (this.classes.length > startIndex) {
            // Match the first character class.
            let charClass: boolean[] = this.classes[startIndex];

            if (this.matchClasses(startIndex + 1))
                return true;

            for (let i = 0; i < 26; ++i) {
                if (charClass[i] && this.letterCount[i] > 0) {
                    // possible match. Recursively check.
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
    }

    public matchLiterals(): boolean {
        // Match up all the literals.
        for (let c = 0; c < 26; ++c) {
            if (this.literals[c] > 0) {
                this.letterCount[c] -= this.literals[c];
            }
        }

        return this.matchClasses(0);
    }

    public matchWord(word: string): boolean {
        let length = word.length;
        if (length > this.maxLength)
            return false;

        this.countLetters(word);

        return this.matchLiterals();

    }
}

class CryptoMatch implements IMatcher {
    private regex: RegExp = new RegExp("");

    public toString() {
        return "Cryptogram";
    }

    public reverseMeaningful(): boolean { return true; }

    public maxMistakes(): number { return 0; }


    public help(): string {
        return "Type a cryptogram pattern.\r\n(example: XYZZY matches PENNE)\r\n\r\n?\tmatches any letter\r\n*\tmatches zero or more letters";
    }

    private translateToRegex(pattern: string): string {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        let builder: string = "";
        let charsUsedSoFar: string = "";

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

            if (el.kind === QueryElementKind.Letter) {
                let c: string = el.letter;

                if (charsUsedSoFar.indexOf(c) >= 0) {
                    // Char used already
                    builder += "\\";
                    builder += (charsUsedSoFar.indexOf(c) + 1).toString(10);
                }
                else {
                    // Char not used already.
                    builder += "(";

                    if (charsUsedSoFar !== "") {
                        // Don't match any character already used.
                        builder += "(?!";  // not

                        // any character not used so far
                        for (let j = 0; j < charsUsedSoFar.length; ++j) {
                            if (j !== 0)
                                builder += "|";

                            builder += "\\";
                            builder += (j + 1).toString(10);
                        }

                        builder += ")";  // end not
                    }
                    builder += ".";  // any character

                    builder += ")";

                    // add to list of characters used.
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
    }


    public setPattern(pattern: string, mistakes: number): void {
        let regexExpression: string = this.translateToRegex(pattern);
        this.regex = new RegExp("^" + regexExpression + "$");
    }

    public matchWord(word: string): boolean {
        return this.regex.test(word);
    }
}

class Subword implements IMatcher {
    // Encoding of the pattern.
    private patternMasks: number[] = [];
    private maxLength: number = 0;

    // Number of allowed mistakes
    private mistakes: number = 0;

    // Temp array for encoding the current word (to avoid lots of allocation/deallocations).
    private wordMasks: number[] = [];
    private wordLength: number = 0;

    public toString(): string {
        return "Subword";
    }

    public reverseMeaningful(): boolean { return true; }

    public maxMistakes(): number { return 5; }

    public shelp(): string {
        return "Type pattern to find subwords.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n";
    }

    public setPattern(pattern: string, mistakes: number): void {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        let maskList: number[] = [];
        this.maxLength = 0;
        this.mistakes = mistakes;

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

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
    }

    private encodeWord(word: string): void {
        this.wordLength = word.length;
        for (let i = 0; i < this.wordLength; ++i) {
            this.wordMasks[i] = MatchDriver.maskFromLetter(word[i]);
        }
    }

    private matchesAt(index: number): boolean {
        let mistakesLeft = this.mistakes;
        for (let i = 0; i < this.wordLength; ++i) {
            if ((this.wordMasks[i] & this.patternMasks[i + index]) == 0) {
                if (mistakesLeft > 0)
                    mistakesLeft -= 1;
                else
                    return false;
            }
        }

        return true;
    }

    public matchWord(word: string): boolean {
        if (word.length > this.maxLength)
            return false;

        this.encodeWord(word);

        for (let index = 0; index <= this.maxLength - this.wordLength; ++index) {
            if (this.matchesAt(index))
                return true;
        }

        return false;
    }
}

class Insertion implements IMatcher {
    // Variables to store the regex's to match against.
    private regexList: RegExp[] = [];
    private minLength: number = 0;

    // Allow a mistake?
    private allowOneMistake: boolean = false;

    public toString(): string {
        return "Insert";
    }

    public reverseMeaningful(): boolean { return true; }

    public maxMistakes(): number { return 1; }

    public help(): string {
        return "Type a pattern to insert consecutive letters into.\r\n\r\n" +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    }

    private translateToRegex(query: QueryElement[], mistakePosition: number, addPlusPosition: number): { regex: string, nonStarsFound: number } {
        let builder: string = "";

        let nonStarsFound = 0;

        builder += '^';

        for (let i = 0; i < query.length; ++i) {
            let el: QueryElement = query[i];

            if (el.kind == QueryElementKind.Letter) {
                if (nonStarsFound == mistakePosition)
                    builder += '.';
                else
                    builder += el.letter;

                nonStarsFound += 1;
                if (nonStarsFound == addPlusPosition)
                    builder += ".+";
            }
            else if (el.kind == QueryElementKind.Wild) {
                builder += ".";
                nonStarsFound += 1;
                if (nonStarsFound == addPlusPosition)
                    builder += ".+";
            }
            else if (el.kind == QueryElementKind.Star) {
                builder += ".*";
            }
            else if (el.kind == QueryElementKind.MultiLetter) {
                if (nonStarsFound == mistakePosition) {
                    builder += '.';
                    nonStarsFound += 1;
                }
                else {
                    builder += "[";
                    for (let c = 0; c < 26; ++c) {
                        if ((el.mask & MatchDriver.maskFrom0to25(c)) != 0) {
                            builder += MatchDriver.letterFromOrdinal(c);
                        }
                    }
                    builder += "]";
                }

                nonStarsFound += 1;
            }
            else {
                throw new Error("Unexpected query element");
            }
        }

        builder += '$';

        return { regex: builder, nonStarsFound: nonStarsFound };
    }

    public setPattern(pattern: string, mistakes: number) {
        let query: QueryElement[] = MatchDriver.parseQueryText(pattern);

        let result = this.translateToRegex(query, -1, -1);
        let minLength = result.nonStarsFound;
        let regexString = result.regex;

        if (mistakes == 1)
            this.allowOneMistake = true;
        else if (mistakes == 0)
            this.allowOneMistake = false;
        else
            throw new Error("Insertion does not allow more than 1 mistake!");

        let regex: RegExp;
        this.regexList = [];

        if (!this.allowOneMistake) {
            try {
                for (let addPlusPosition = 1; addPlusPosition < minLength; ++addPlusPosition) {
                    regexString = this.translateToRegex(query, -1, addPlusPosition).regex;
                    regex = new RegExp(regexString, 'i');
                    this.regexList.push(regex);
                }
            }
            catch (e) {
                throw new Error(e.message);
            }
        }
        else if (mistakes == 1) {
            try {
                for (let mistakePosition = 0; mistakePosition < minLength; ++mistakePosition) {
                    for (let addPlusPosition = 1; addPlusPosition < minLength; ++addPlusPosition) {
                        regexString = this.translateToRegex(query, -1, addPlusPosition).regex;
                        regex = new RegExp(regexString, 'i');
                        this.regexList.push(regex);
                    }
                }
            }
            catch (e) {
                throw new Error(e.message);
            }
        }
    }

    public matchWord(word: string): boolean {
        let length = word.length;
        if (length < this.minLength)
            return false;

        for (let regex of this.regexList) {
            if (regex.test(word))
                return true;
        }

        return false;
    }
}

class RegExpression implements IMatcher {
    private regex: RegExp = new RegExp("");

    public toString(): string {
        return "RegEx";
    }

    public reverseMeaningful(): boolean { return true; }

    public maxMistakes(): number { return 0; }

    public help(): string {
        return "Type a pattern to match with Javascript regular expressions.";
    }

    public setPattern(pattern: string, mistakes: number): void {
        this.regex = new RegExp("^" + pattern + "$", 'i');
    }

    public matchWord(word: string): boolean {
        return this.regex.test(word);
    }
}

