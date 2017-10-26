importScripts('wordmancore.js');

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

class Actions extends WorkerClass {
    private wordLists: Map<string,WordList> = new Map<string, WordList>();

    public async loadWordsFromUrl(url: string, name: string): Promise<number> {
        let fileContents: Response = await fetch(url);
        let text = await fileContents.text();
        let wordList = new WordList(text);
        this.wordLists.set(name, wordList);
        return wordList.count();
    }

    public findMatches(query: string, lists: string[], options: MatchOptions): MatchResult {
        let matcher: IMatcher = new Pattern(false);
        let list = this.wordLists.get(lists[0]);
        if (!list) {
            throw new Error(`word list ${lists[0]} is not loaded`);
        }
        return MatchDriver.findMatches(matcher, list, query, { mistakes: 0, reverse: false, maxReturn: 100 });
    }
}

var myActions = new Actions();

