$(function (): void {
    Program.start();
});

$("#search_button").click((e) => {
    let queryText = (<string>$("#query_text").val());
    Program.findMatches(queryText);
});

class AsyncWorker {
    private worker: Worker;
    private scriptUrl: string;
    private workerIsRunning: boolean;
    private workerMethodId: number = 0;
    private promises: Map<number, { resolve: (value?: any) => void, reject: (value?: any) => void }> = new Map();

    // Load the script into a web worker.
    public constructor(scriptUrl: string) {
        this.scriptUrl = scriptUrl;
        this.loadWorker();

        this.worker.addEventListener('message', (ev) => {
            if (ev.data.hasOwnProperty('result')) {
                this.resultReturned(ev.data.id, ev.data.result);
            }
            else if (ev.data.hasOwnProperty('failure')) {
                this.failureReturned(ev.data.id, ev.data.failure);
            }
        });

        this.worker.addEventListener('error', (ev) => {
            // Something bad happened. Reload the worked.
            this.loadWorker();
        });
    }

    // Execute an action with the given arguments on the web worker.
    // Action is the method name in the worker. Returns a promise that
    // will have the result of executing that method.
    public execute(action: string, ...args: any[]): Promise<any> {
        if (this.workerIsRunning) {
            throw new Error("Cannot execute new work while the working is busy.");
        }

        this.workerIsRunning = true;
        this.workerMethodId += 1;
        let currentId = this.workerMethodId;
        this.worker.postMessage({ id: currentId, action: action, args: args });
        return new Promise<any>((resolve, reject) => {
            this.promises.set(currentId, { resolve: resolve, reject: reject });
        });
    }

    // Is the working busy running something? You cannot execute anything new
    // while the worker is busy.
    public isBusy(): boolean {
        return this.workerIsRunning;
    }

    // Reset the worker, if it is hung.
    public reset(): void {
        this.loadWorker();
    }

    // A result was returned from the Worker. Pass it on to the promise.
    private resultReturned(id: number, result: any): void {
        this.workerIsRunning = false;

        let promise = this.promises.get(id);
        this.promises.delete(id);
        if (promise) {
            promise.resolve(result);
        }
    }

    private failureReturned(id: number, reason: any): void {
        this.workerIsRunning = false;

        let promise = this.promises.get(id);
        this.promises.delete(id);
        if (promise) {
            promise.reject(reason);
        }
    }

    // Load or reload the worker.
    private loadWorker(): void {
        if (this.worker) {
            this.worker.terminate();
        }
        this.worker = new Worker(this.scriptUrl);
    }
}

class Program {
    private static worker: AsyncWorker;

    static async start(): Promise<void> {
        this.initWorker();
        $("h1").html("Loading word list.");
        let totalWords = await this.loadWordLists();
        $("h1").html(`Word lists loaded with ${totalWords} total words.`);
    }

    private static initWorker(): void {
        this.worker = new AsyncWorker('/worker/worker.js');
    }

    static async loadWordLists(): Promise<number> {
        let totalWords = 0;
        totalWords += await this.loadWordListFromUrl("/Common%20words.words.txt", "Common words");
        return totalWords;
    }

    static async loadWordListFromUrl(url: string, name: string): Promise<number> {
        return await this.worker.execute("loadWordsFromUrl", url, name);
    }

    static async findMatches(query: string): Promise<void> {
        $("h1").html(`Beginning search`);

        try {

            let matchResult = await this.worker.execute("findMatches", query, ["Common words"], { mistakes: 0, reverse: false, maxReturn: 100 });

            $("h1").html(`Matched ${matchResult.matches.length} words`);
            $("#results").html(matchResult.matches.join("\r\n"));
        }
        catch (err) {
            $("h1").html("Exception occurred: " + err.message);
            $("#results").html(`name: ${err.name} message: ${err.message} stack: ${err.stack}`);
        }
    }

}
