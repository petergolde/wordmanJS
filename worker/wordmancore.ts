
class WordList {
    public words: string[];
    public static aCodePoint: number = "A".charCodeAt(0);
    public static zCodePoint: number = "Z".charCodeAt(0);

    private constructor(sanitizedWordList: string[]) {
        this.words = sanitizedWordList;
    }

    public static create(wordFile: string, sanitize: boolean): WordList {
        let newList = [];
        let lines: string[] = wordFile.split("\r\n");
        for (let line of lines) {
            if (sanitize) {
                line = this.sanitize(line);
            }
            newList.push(line);
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
            let word:string|null = null;
            for (let i = 0; i < listsToMerge.length; ++i) {
                let newWord:string|null = null;
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
            if ((options.minLength !== undefined && len < options.minLength) || (options.maxLength != undefined && len > options.maxLength))
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

    public static maskFrom0to25(i: number): number { 
        if (i < 0 || i > 25) {
            throw new Error("Bad letter index");
        }

        return 1 << i;
    }

    public static maskFromLetter(letter: string): number {
        let code = <number>letter.toUpperCase().charCodeAt(0);
        if (code < WordList.aCodePoint || code > WordList.zCodePoint) {
            throw new Error("bad letter");
        }

        return this.maskFrom0to25(code - WordList.aCodePoint);
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

class Pattern implements IMatcher
{
    private isSuperWord: boolean;	// Pattern or superword?

    private usingRegex: boolean;			// If true, using the regex method

	// Variables to store the pattern using the regex method
	private regexList: RegExp[];
    private minLength: number;
    private hasStar: boolean;

    // Variables to stort the pattern using the mask method
    // Encoding of the pattern.
    private patternMasks: number[];

    // Number of allowed mistakes
    private mistakes: number;

	// Temp array for encoding the current word (to avoid lots of allocation/deallocations).
	private wordMasks: number[] = [];
	private wordLength: number;

	public constructor(isSuperWord: boolean) {
        this.isSuperWord = isSuperWord;
    }

	public toString(): string {
        return this.isSuperWord ? "Superword" : "Pattern";
    }

	public reverseMeaningful(): boolean {
        return true; 
    }

	public maxMistakes(): number 
    {
        if (this.isSuperWord)
            return 1;
        else
            return 5;
    }

	public help(): string 
    {
        return (this.isSuperWord ? "Type a pattern to find superwords of.\r\n\r\n" : "Type a pattern to match, in order.\r\n\r\n") +
            "?\tmatches any letter\r\n" +
            "[abc]\tmatches any one of a,b,c\r\n" +
            "[^abc]\tmatches any but a,b,c\r\n" +
            "*\tmatches zero or more letters";
    }

	private translateToRegex(query: QueryElement[], mistakePosition: number) : {regex: RegExp, nonStarsFound: number, hasStar: boolean} {
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

        return {regex:new RegExp(builder), nonStarsFound: nonStarsFound, hasStar: hasStar};
    }

	private setupRegexMethod(query: QueryElement[], mistakes: number): void
    {
        let regexResult = this.translateToRegex(query, -1);
        this.usingRegex = true;
        this.hasStar = regexResult.hasStar;
        this.minLength = regexResult.nonStarsFound;

        let regex = regexResult.regex;
        this.regexList = [regex];

        if (mistakes == 1) {
            // Create a regex for correct, and for each possible mistake position.
            for (let mistakePosition = 0; mistakePosition < this.minLength; ++mistakePosition) 
            {
                regexResult = this.translateToRegex(query, mistakePosition);
                this.regexList.push(regexResult.regex);
            }
        }
        else if (mistakes != 0) {
            throw new Error("Can not have more than 1 mistake!");
        }
    }

	private setupMaskMethod(query: QueryElement[], mistakes: number): void
    {
        this.usingRegex = false;
        this.hasStar = false;
        this.mistakes = mistakes;
        this. minLength = query.length;

        let maskList: number[] = [];

        for (let i = 0; i < query.length; ++i) 
        {
            let el: QueryElement = query[i];
            if (el.kind == QueryElementKind.Star)
                throw new Error("Cannot use '*' or '@' in this query");

            maskList.push(el.mask);
        }

        if (this.minLength != maskList.length)
            throw new Error("Huh?");

        this.patternMasks = maskList;
    }

	public setPattern(pattern: string, mistakes: number): void
    {
        let query: QueryElement[]  = MatchDriver.parseQueryText(pattern);

        this.hasStar = false;
        this.mistakes = mistakes;
        for(let el of query) {
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

	private encodeWord(word: string): void
    {
        this.wordLength = word.length;
        for (let i = 0; i < this.wordLength; ++i) 
        {
            this.wordMasks[i] = MatchDriver.maskFromLetter(word[i]);
        }
    }

	public matchWord(word: string): boolean
    {
        let length = word.length;
        if (length < this.minLength)
            return false;
        if (!this.hasStar && length > this.minLength)
            return false;

        if (this.usingRegex) {
            for(let regex of this.regexList)
            {
                if (regex.exec(word))
                    return true;
            }

            return false;
        }
        else {
            this.encodeWord(word);

            let mistakesLeft = this.mistakes;
            for (let i = 0; i < this.wordLength; ++i) 
            {
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
