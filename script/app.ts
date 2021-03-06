///<reference path="../node_modules/@types/jquery/JQuery.d.ts" />
///<reference path="../node_modules/@types/bootstrap/index.d.ts" />

$(function (): void {
    // $('#main').css('padding-top', $('#header').height() + 'px');
    $("#querytype-select > option[value=pattern]").attr('selected', "true");
    Program.start();


    $("#main_form").submit((e) => {
        let queryText = <string>$("#query_text").val();
        Program.findMatches(queryText);
        e.preventDefault();
    });
    
    $("#search_results_button").click(e => {
        let queryText = <string>$("#query_text").val();
        Program.findMatchesInCurrentResults(queryText);
        e.preventDefault();
    });

    $("#back_button").click(e => {
        Program.backButtonClicked();
    });

    $("#sort-select-1").change(e => {
        Program.resize();
    });

    $("#sort-select-2").change(e => {
        Program.resize();
    });

    $("#querytype-select").change(e => {
        Program.updateHelp();
    });

    $("#addwordlist").click(e => {
        Program.addWordList();
    });


    $("#customwordlistselected").click(e => {
        Program.selectedWordList();
    });

    $(window).resize(e => {
        Program.resize();
    });
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
        this.worker = this.loadWorker();
        this.workerIsRunning = false;

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
            throw new Error("Cannot execute new work while the worker is busy.");
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
    private loadWorker(): Worker {
        if (this.worker) {
            this.worker.terminate();
        }
        this.worker = new Worker(this.scriptUrl);
        return this.worker;
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

    private static currentResults: string[] = [];
    private static blobUrl: string;

    public static async start(): Promise<void> {
        this.initWorker();
        this.showWordListUi();
        this.updateHelp();

        this.showAlert("Loading word list.", this.yellowColor);
        let totalWords = await this.loadWordLists();
        this.showAlert(`Word lists loaded with ${totalWords} total words.`, this.greenColor);
    }

    private static setHelpText(matcher: string)
    {
        var helpElement: JQuery<HTMLElement>;
        helpElement = $("#help-" + matcher);
        $("#helplocation").html(helpElement.html());
        
    }

    public static updateHelp()
    {
        let matchType: string = this.collectMatchType();
        this.setHelpText(matchType);
    }

    public static backButtonClicked() {
        this.showResults(false);
    }

    private static showResults(showResults: boolean) {
        if (showResults) {
            $("#results_pane").addClass("show-results");
            $("#header").removeClass("show-header");
        }
        else {
            $("#results_pane").removeClass("show-results");
            $("#header").addClass("show-header");
        }
    }


    private static async findMatchesCore(query: string, wordListsToSearch: string[]): Promise<void> {

        this.showAlert(`Beginning search`, this.yellowColor);

        try {
            let matchType = this.collectMatchType();
            let matchOptions = this.collectOptions();

            if (wordListsToSearch.length === 0) {
                this.showAlert("No word lists selected", this.redColor);
                $("#search_results_button").prop("disabled", true);
                return;
            }

            this.showResults(true);

            let matchResult = <MatchResult>await this.worker.execute("findMatches", query, matchType, wordListsToSearch, matchOptions);

            if (matchResult.hitMaximum) {
                this.showAlert(`Too many words found. Showing first ${matchResult.matches.length} words.`, this.yellowColor);
            }
            else {
                this.showAlert(`Matched ${matchResult.matches.length} words`, this.greenColor);
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
        }
        catch (err) {
            this.showAlert(err.message, this.redColor);
            $("#results").html("");
            $("#search_results_button").prop("disabled", true);
            this.updateSaveButton([]);
        }
    }

    public static findMatches(query: string): Promise<void> {
        let wordListsToSearch = this.collectWordLists();
        return this.findMatchesCore(query, wordListsToSearch);
    }

    public static findMatchesInCurrentResults(query: string): Promise<void> {
        let wordListsToSearch = ["current_results"];
        return this.findMatchesCore(query, wordListsToSearch);
    }

    public static resize()
    {
        if (this.currentResults) {
            this.displayResults(this.currentResults);
        }
    }

    static readonly padding = "                                                                                                           ";

    private static displayResultsInColumns(results: string[]): void
    {
        let maxLength: number = 0;
        for (let word of results) {
            if (word.length > maxLength) {
                maxLength = word.length;
            }
        }

        let charHeight = 16;
        let rows = Math.floor((<number>$("#results_container").outerHeight()-16) / charHeight);
        let cols = Math.ceil(results.length / rows);
        let wrappedText = "";

        for (let row = 0; row < rows; ++row) {
            for (let col = 0; col < cols; ++col) {
                let index = col * rows + row;
                if (index < results.length) {
                    let word = results[index];
                    wrappedText += word + this.padding.substr(0, maxLength + 5 - word.length);
                    
                }
            }
            wrappedText += "\r\n";
        }

        $("#results").html(wrappedText);
    }

    private static getResultsAsText(results: string[]): string {
        let wrappedText = "";
        for (let word of results) {
            wrappedText += word;
            wrappedText += "\r\n";
        }
        return wrappedText;
    }

    private static displayResultsInRows(results: string[]): void {
        var wrappedText = this.getResultsAsText(results);
        $("#results").html(wrappedText);
    }

    private static displayResults(results: string[]) : void {
        var mobile: boolean = ($("#back_bar").css("display") != "none");
        var sorting: string;

        if (mobile) {
            sorting = <string> $("#sort-select-2").val();
        }
        else {
            sorting = <string> $("#sort-select-1").val();
        }

        if (sorting == "length") {
            results = results.sort((s1, s2) => {
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
    }

    private static updateSaveButton(results: string[])
    {
        var saveLink = $(".download-results");
        
        if (results && results.length > 0) {
            var resultsText: string = this.getResultsAsText(results);
            var blob: Blob = new Blob([resultsText], { type: 'text/plain' });

            if (this.blobUrl) {
                window.URL.revokeObjectURL(this.blobUrl);
                this.blobUrl = "";
            }
            this.blobUrl = window.URL.createObjectURL(blob);

            saveLink.each((number, element) =>  {
                (<HTMLAnchorElement>element).href = this.blobUrl;
            });
                
            saveLink.removeClass("disabled");
        }
        else {
            saveLink.addClass("disabled");
        }
    }
    
    private static initWorker(): void {
        this.worker = new AsyncWorker('/worker/worker.js');
    }

    private static builtInWordLists = [
        "Common words", "ENABLE", "ENABLE rare words", "Idioms", "Kitchen Sink",
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
            if (wl=="Common words" || wl=="ENABLE") {
                container.append(`<input type="checkbox" value="${wl}" checked/> ${wl}<br />`);
            }
            else {
                container.append(`<input type="checkbox" value="${wl}"/> ${wl}<br />`);
            }
        }
    }

    private static collectOptions(): MatchOptions {
        return {
            reverse: $("#reverse-checkbox").prop('checked'),
            mistakes: parseInt(<string>$("#mistakes-select").val()),
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
                wordLists.push(<string>wordListCheckboxes.eq(i).val())
            }
        }

        return wordLists;
    }

    private static collectMatchType(): string {
        return <string>$("#querytype-select").val();
    }

    private static showAlert(text: string, color: string): void {
        $(".message-line").html(text).css("background-color", color);
    }

    public static addWordList() {
        $("#wordlistname").val("");
        $("#customwordlistfile").val("");
        $("#customWordListModal").modal();
    }


    public static selectedWordList() {
        $("#customWordListModal").modal('hide');
        var wordListName:string = <string>($("#wordlistname").val());
        var wordListFile: File;

        let wordListFileElement = (<HTMLInputElement>$("#customwordlistfile")[0]);
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
        var fileText: string = "";
        fileReader.onload = async () => {
            if (fileReader.result == null) {
                this.showAlert("Could not read word list file", this.redColor);
                return;
            }
            fileText = <string> fileReader.result;
            if (fileText.length == 0) {
                this.showAlert("Could not read word list file", this.redColor);
                return;
            }

            await this.worker.execute("loadWordsFromString", fileText, wordListName);
            this.customWordLists.push(wordListName);
            this.showAlert("Word list '" + wordListName + "' successfully loaded", this.greenColor);
            this.showWordListUi();
        };
        fileReader.readAsText(wordListFile);
    }

    /*
    private static clearAlert(): void {
        $(".message-line").html("&nbsp;").css("background-color", "");
    }
    */

    /**
     * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
     * 
     * @param {String} text The text to be rendered.
     * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
     * 
     * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
     */
    private static canvasCache: HTMLCanvasElement;
    public static getTextWidth(text: string, font: string): number {
        // re-use canvas object for better performance
        var canvas = this.canvasCache || (this.canvasCache = document.createElement("canvas"));
        var context = <CanvasRenderingContext2D>canvas.getContext("2d");
        context.font = font;
        var metrics = context.measureText(text);
        return metrics.width;
    }
}

