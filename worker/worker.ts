importScripts('wordmancore.js');

/** A helper class for Web Workers. Derive from this class and add public functions that do the web worker actions.
 * If the functions return a Promise, that promise is used for the action.
 */
class WorkerClass
{
    public constructor()
    {
        addEventListener("message", async (ev) => {
            let data: any = ev.data;
            let id = data.id;

            try {
                let func: any = (this as any)[data.action];
                if (typeof func != "function") {
                    postMessage({ id: id, failure: new Error(`Worker does not have a function names ${data.action}`) });
                }
                else {
                    let result: any = func.apply(this, data.args);
                    if (result instanceof Promise) {
                        result.then(promiseResult => postMessage({ id: id, result: promiseResult }), 
                                    errObj => this.postFailure(id, errObj));
                    }
                    else {
                        postMessage({ id: id, result: result });
                    }
                } 
            }
            catch (exception) {
                this.postFailure(id, exception);
            }
        });  
    }

    private postFailure(id: number, errorObj: any) {
        postMessage({id: id, failure: {name: errorObj.name, message: errorObj.message, stack: errorObj.stack}});
    }
}

/** The actions called by the main applications to handle WordMan searches in the background. */
class Actions extends WorkerClass {
    private wordLists: Map<string,WordList> = new Map<string, WordList>();
    private currentWordList: WordList|null = null; 
    private currentWordListNames: string[] = [];

    public async loadWordsFromUrl(url: string, name: string): Promise<number> {
        let fileContents: Response = await fetch(url);
        let text = await fileContents.text();
        let wordList = WordList.create(text, false);  // don't need to sanitize word list from URL.
        this.wordLists.set(name, wordList);
        return wordList.count();
    }

    public findMatches(query: string, matchType: string, lists: string[], options: MatchOptions): MatchResult {
        let matcher: IMatcher = new Pattern(false);
        let list = this.getWordList(lists);
        return MatchDriver.findMatches(matcher, list, query, options);
    }

    private getWordList(wordListNames: string[]): WordList
    {
        if (this.currentWordList !== null && this.arrayEquals(this.currentWordListNames, wordListNames)) {
            return this.currentWordList;
        }
        else {
            this.currentWordList = WordList.merge(wordListNames.filter(name => this.wordLists.has(name))
                                                               .map((name) => <WordList> this.wordLists.get(name)));
            this.currentWordListNames = wordListNames;
            return this.currentWordList;                                                   
        }
    }

    private arrayEquals<T>(a1: T[], a2:T[]): boolean
    {
        if (a1.length !== a2.length) {
            return false;
        }

        for (let i = 0; i < a1.length; ++i) {
            if (a1[i] !== a2[i]) {
                return false;
            }
        }

        return true;
    }
}

var myActions = new Actions();

