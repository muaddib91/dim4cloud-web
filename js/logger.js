/*
    Swisscom DIM 5.1.8
    Copyright(c) by PrimeSoft AG
*/
class Logger {

    loggerName;
    webView;
    constructor(loggerName) {
        this.loggerName = loggerName;
        this.webView = typeof (chrome) !== "undefined";
    }
    
    logDebug(message) {
        this.log("debug", message);
    }

    logInfo(message) {
        this.log("info", message);
    }

    logWarn(message) {
        this.log("warn", message);
    }

    logError(message) {
        this.log("error", message);
    }

    log(level, message) {
        if (this.webView) {
            chrome.webview.postMessage({ type: "logMessage", level: level, source: this.loggerName, message: message });
        } else {
            if (level === "debug") {
                console.debug(this.loggerName + ": " + message);
            } else if (level === "info") {
                console.log(this.loggerName + ": " + message);
            } else if (level === "warn") {
                console.warn(this.loggerName + ": " + message);
            } else {
                console.error(this.loggerName + ": " + message);
            }
        }
    }
}
