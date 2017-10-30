$(function (): void {
    $('#main').css('padding-top', $('#header').height() + 'px');
    $("#querytype-select > option[value=pattern]").attr('selected', "true");
    Program.start();
});

$("#main_form").submit((e) => {
    let queryText = <string>$("#query_text").val();
    Program.findMatches(queryText);
    e.preventDefault();
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
            // Something bad happened. Reload the worker.
            console.error("Error in web worker: " + ev);
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

class Program {
    private static worker: AsyncWorker;

    private static greenColor = "#bbffaa";
    private static yellowColor = "#ffffaa";
    private static redColor = "#ffaaaa";

    public static async start(): Promise<void> {
        this.initWorker();
        this.showWordListUi();

        this.showAlert("Loading word list.", this.yellowColor);
        let totalWords = await this.loadWordLists();
        this.showAlert(`Word lists loaded with ${totalWords} total words.`, this.greenColor);
    }


    public static async findMatches(query: string): Promise<void> {
        this.showAlert(`Beginning search`, this.yellowColor);

        try {
            let matchType = this.collectMatchType();
            let wordListsToSearch = this.collectWordLists();
            let matchOptions = this.collectOptions();

            if (wordListsToSearch.length === 0) {
                this.showAlert("No word lists selected", this.redColor);
                return;
            }

            let matchResult = <MatchResult>await this.worker.execute("findMatches", query, matchType, wordListsToSearch, matchOptions);

            if (matchResult.hitMaximum) {
                this.showAlert(`Too many words found. Showing first ${matchResult.matches.length} words.`, this.yellowColor);
            }
            else {
                this.showAlert(`Matched ${matchResult.matches.length} words`, this.greenColor);
            }
            $("#results").html(matchResult.matches.join("\r\n"));
        }
        catch (err) {
            this.showAlert("Exception occurred", this.redColor);
            $("#results").html(`name: ${err.name} message: ${err.message} stack: ${err.stack}`);
        }
    }

    private static initWorker(): void {
        this.worker = new AsyncWorker('/worker/worker.js');
    }

    private static builtInWordLists = [
        "Common words", "ENABLE rare words", "ENABLE", "Idioms", "Kitchen Sink",
        "Names", "NYT Crosswords", "Places", "UK advanced cryptics", "Websters New Intl"
    ];

    private static customWordLists: string[] = [];

    private static async loadWordLists(): Promise<number> {
        let totalWords = 0;
        for (let wl of this.builtInWordLists) {
            let url = "/wordlists/" + wl.replace(/ /, "%20") + ".words.txt";
            totalWords += await this.loadWordListFromUrl(url, wl);
        }

        return totalWords;
    }

    private static async loadWordListFromUrl(url: string, name: string): Promise<number> {
        return await this.worker.execute("loadWordsFromUrl", url, name);
    }

    private static showWordListUi(): void {
        let container = $("#wordlist-container");
        container.empty();
        for (let wl of this.builtInWordLists.concat(this.customWordLists)) {
            container.append(`<input type="checkbox" value="${wl}"/> ${wl}<br />`);
        }
    }

    private static collectOptions(): MatchOptions {
        return {
            reverse: $("#reverse-checkbox").prop('checked'),
            mistakes: parseInt(<string> $("#mistakes-select").val()),
            minLength: parseInt(<string>$("#minlength-select").val()),
            maxLength: parseInt(<string>$("#maxlength-select").val()),
            maxReturn: 10000
        };
    }

    private static collectWordLists(): string[] {
        let wordLists: string[] = [];
        let wordListCheckboxes = $("#wordlist-container input");
        for (let i = 0; i < wordListCheckboxes.length; ++i) {
            if (wordListCheckboxes.eq(i).prop('checked')) {
                wordLists.push(<string> wordListCheckboxes.eq(i).val())
            }
        }

        return wordLists;
    }

    private static collectMatchType(): string {
        return <string> $("#querytype-select").val();
    }

    private static showAlert(text: string, color: string): void {
        $("#message-line").html(text).css("background-color", color);
    }

    /*
    private static clearAlert(): void {
        $("#message-line").html("&nbsp;").css("background-color", "");
    }
    */
}

