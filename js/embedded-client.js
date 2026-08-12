/*
    Swisscom DIM 5.1.8
    Copyright(c) by PrimeSoft AG
*/
class EmbeddedClient {
    contentWindow;
    apiBaseUrl;
    genesysLogger;
    onLogin = null;
    onConfig = null;
    webView = false;
    authToken = null;
    configGroups = new Map();
    presenceList = null;
    currentUserId = null;

    constructor(contentWindow, envBaseUrl) {
        this.contentWindow = contentWindow;
        this.apiBaseUrl = `https://api.${envBaseUrl}`;
        this.genesysLogger = new Logger("Genesys");
        this.webView = typeof (chrome) !== "undefined" && typeof (chrome.webview) !== "undefined";

        window.addEventListener("message", (event) => { this.messageReceived(event); });
    }

    messageReceived(event) {
        try {
            var message = JSON.parse(event.data);
            if (message.type) {

                switch (message.type) {
                    case "userActionSubscription":
                        if (message.data.category === "login") {
                            if (this.onLogin && typeof (this.onLogin) === "function") {
                                this.onLogin();
                            }
                        }
                        break;

                    case "presenceList":
                        this.presenceList = message.data;
                        this.genesysLogger.logDebug(`${this.presenceList.length} presence definitions loaded.`);
                        break;

                    case "groupList":
                        // add groups starting with SwisscomDIM_ to configGroups
                        for (let i = 0; i < message.data.entities.length; i++) {
                            if (message.data.entities[i].name.startsWith("SwisscomDIM_")) {
                                this.configGroups.set(message.data.entities[i].id, message.data.entities[i].name.substr("SwisscomDIM_".length));
                            }
                        }

                        this.genesysLogger.logDebug(`${this.configGroups.size} config group(s) loaded.`);
                        this.contentWindow.postMessage(JSON.stringify({ type: "getCurrentUser" }), "*");
                        break;

                    case "currentUser":
                        let division = message.data.division.name;
                        let configGroup = "";

                        this.currentUserId = message.data.id;

                        for (let i = 0; i < message.data.groups.length; i++) {
                            if (this.configGroups.has(message.data.groups[i].id)) {
                                configGroup = this.configGroups.get(message.data.groups[i].id)
                                break;
                            }
                        }

                        this.genesysLogger.logDebug(`Current user loaded. Name=${message.data.name}, Division=${division}, Group=${configGroup}`);

                        if (this.onConfig && typeof (this.onConfig) === "function") {
                            this.onConfig(division, configGroup);
                        }

                        break;
                }

                if (this.webView) {
                    chrome.webview.postMessage(message);
                }
            } else {
                this.genesysLogger.logError("Message cannot be parsed: " + event.data);
            }
        } catch {
            this.genesysLogger.logError("Message cannot be parsed: " + event.data);
        }
    }

    answer(callId) {
        this.genesysLogger.logInfo(`Answering call ${callId} ...`);
        this.contentWindow.postMessage(JSON.stringify({ type: "updateInteractionState", data: { action: "pickup", id: callId } }), "*");
    }

    disconnect(callId) {
        this.genesysLogger.logInfo(`Disconnecting call ${callId} ...`);
        this.contentWindow.postMessage(JSON.stringify({ type: "updateInteractionState", data: { action: "disconnect", id: callId } }), "*");
    }

    hold(callId) {
        this.genesysLogger.logInfo(`Holding call ${callId} ...`);
        this.contentWindow.postMessage(JSON.stringify({ type: "updateInteractionState", data: { action: "hold", id: callId } }), "*");
    }

    dial(number, queueId, attributes) {
        this.contentWindow.postMessage(JSON.stringify({ type: "clickToDial", data: { number: number, type: "call", autoPlace: true, queueId: queueId, attributes: attributes } }), "*");
    }

    blindTransfer(interactionId, destination, context) {
        if (context) {
            let addTransferContextMsg = {
                name: "DIM-5",
                attributes: context
            };
            this.contentWindow.postMessage(JSON.stringify({ type: "addTransferContext", data: addTransferContextMsg }), "*");
        }

        let transferMsg = {
            action: "blindTransfer",
            id: interactionId,
            participantContext: {
                transferTarget: destination,
                transferTargetType: "address"
            }
        };
        this.contentWindow.postMessage(JSON.stringify({ type: "updateInteractionState", data: transferMsg }), "*");
    }

    consultTransfer(interactionId, destination, context) {
        if (context) {
            let addTransferContextMsg = {
                name: "DIM-5",
                attributes: context
            };
            this.contentWindow.postMessage(JSON.stringify({ type: "addTransferContext", data: addTransferContextMsg }), "*");
        }

        let transferMsg = {
            action: "consultTransfer",
            id: interactionId,
            participantContext: {
                transferTarget: destination,
                transferTargetType: "address"
            }
        };
        this.contentWindow.postMessage(JSON.stringify({ type: "updateInteractionState", data: transferMsg }), "*");
    }

    getAuthTokenAndData() {
        this.contentWindow.postMessage(JSON.stringify({ type: "getAuthTokenAndData", apiBaseUrl: this.apiBaseUrl }), "*");
    }

    setPresence(systemPresence, languageLabel) {
        let presenceId = null;
        for (let i = 0; i < this.presenceList.length; i++) {
            if (this.presenceList[i].systemPresence === systemPresence) {
                if (languageLabel === "" || this.presenceList[i].languageLabels.en_US === languageLabel || this.presenceList[i].languageLabels.de === languageLabel) {
                    presenceId = this.presenceList[i].id;
                    break;
                }
            }
        }

        if (presenceId) {
            this.genesysLogger.logDebug(`${systemPresence}/${languageLabel} => ${presenceId}`);
            this.contentWindow.postMessage(JSON.stringify({ type: "setPresence", currentUserId: this.currentUserId, presenceId: presenceId }), "*");
        } else {
            this.genesysLogger.logError(`No precence definition found for ${systemPresence}/${languageLabel}`);
        }
    }
}