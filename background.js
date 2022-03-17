const filter = { urls: ["*://*.paypal.com/*"] };

const optionsOnHeadersReceived = ["responseHeaders"];
const optionsOnBeforeRequest = ["requestBody"];

class SDK {
    constructor(responseHeaders, url) {
        this.url = url;

        this.paypalDebugId = responseHeaders.find(header => header.name === "paypal-debug-id")?.value;
        this.xCache = responseHeaders.find(header => header.name === "x-cache")?.value;
        this.xCacheHits = responseHeaders.find(header => header.name === "x-cache-hits")?.value;

        let urlParams = new URLSearchParams(new URL(url).search);
        this.clientId = urlParams.get("client-id");
        this.components = urlParams.get("components");
    }
}



class Message {

    constructor(responseHeaders, url) {
        // set url
        this.url = url;
        // set response headers
        this.paypalDebugId = responseHeaders.find(header => header.name === "paypal-debug-id")?.value;
        this.xCache = responseHeaders.find(header => header.name === "x-cache")?.value;
        this.xCacheHits = responseHeaders.find(header => header.name === "x-cache-hits")?.value;
        // set query params
        let urlParams = new URLSearchParams(new URL(url).search);
        this.id = urlParams.get("message_request_id");
        this.merchantConfig = urlParams.get("merchant_config");
        this.sdkMeta = urlParams.get("sdkMeta");
        this.clientId = urlParams.get("client_id");
    }


    addIFrameMessageRequest(responseHeaders, url) {
        let urlParams = new URLSearchParams(new URL(url).search);
        this.iframeMessage = {
            url: url,
            id: urlParams.get("message_request_id"),
            amount: urlParams.get("amount"),
            paypalDebugId: responseHeaders.find(header => header.name === "paypal-debug-id").value,
        };
    }

    addLog(log) {
        if (!this.logs) {
            this.logs = [];
        }
        this.logs.push(log);
    }

}

class DataStore {

    addSdk(tab, sdk) {
        if (!this[tab]) {
            this[tab] = { messages: [], sdk: null };
        }
        this[tab].sdk = sdk;
    }

    addMessage(tab, message) {
        if (!this[tab]) {
            this[tab] = { messages: [], sdk: null };
        }
        this[tab].messages.push(message);
    }

    getSdk(tab) {
        return this[tab] ? this[tab].sdk : null;
    }

    getMessages(tab) {
        return this[tab] ? this[tab].messages : [];
    }

}

// Create DateStore for storing our sdk and messages.
let dataStore = new DataStore();

let onHeadersReceivedCallback = async (details) => {

    let { tabId, url, responseHeaders } = details;

    // parse url into queryparams
    let urlParams = new URLSearchParams(new URL(url).search);

    // There are 4 types of requests:
    // 1. Requests to the sdk endpoint
    // 2. Requests to the message endpoint
    // 3. Requests to the message endpoint from within the message iframe
    // 4. Requests to log event/meta data - Not currently possible to detect this.

    // We get the requests in the order described above.

    if (url.includes("sdk/js")) {
        console.info("SDK Request Detected");
        dataStore.addSdk(tabId, new SDK(responseHeaders, url));

    } else if (url.includes("credit-presentment/smart/message") && urlParams.get("integrationType") === "SDK") {

        console.info("Message Request Detected");
        dataStore.addMessage(tabId, new Message(responseHeaders, url));

        // Update badge
        chrome.action.setBadgeBackgroundColor({ color: "#00c90a", tabId: tabId });
        chrome.action.setBadgeText({ text: dataStore[tabId].messages.length.toString(), tabId: tabId });


    } else if (url.includes("credit-presentment/smart/message") && urlParams.get("integrationType") === null) {
        console.info("IFrame Message Request Detected");
        // append to last message in dataStore since it always follows the non IFrame
        let initialMessageRequest = dataStore[tabId].messages[dataStore[tabId].messages.length - 1];
        initialMessageRequest.addIFrameMessageRequest(responseHeaders, url);

    }
}

let onBeforeRequestCallback = async (details) => {
    let { tabId, url, requestBody } = details;

    if (url.includes("credit-presentment/log")) {
        console.info("Log Request Detected");
        if (!requestBody?.raw) {
            // No request body, maybe OPTIONS request
            return;
        }
        let body = JSON.parse(String.fromCharCode.apply(null,
            new Uint8Array(requestBody.raw[0].bytes)))
        console.log(body)

        // insert logs into related message
        if (!dataStore[tabId]) {
            // No messages to assign logs to, maybe didn't catch the message request
            return;
        }
        let message = dataStore[tabId].messages.find(message => message.id === body.meta[1].messageRequestId)
        message.addLog(body);

    }
    console.log(dataStore)
};


async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

chrome.webRequest.onBeforeRequest.addListener(
    onBeforeRequestCallback, filter, optionsOnBeforeRequest);

chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceivedCallback, filter, optionsOnHeadersReceived);


chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        let requestData = JSON.parse(request.data);
        if (requestData.handshake) {
            // Popup is open, we can send over any data we have
            // Only send data if we have it, otherwise we will send when we get it.
            if (dataStore[requestData.tab]) {
                if (dataStore[requestData.tab].messages && dataStore[requestData.tab].sdk) {
                    sendResponse({
                        "messages": dataStore[requestData.tab].messages,
                        "sdk": dataStore[requestData.tab].sdk
                    });
                }
            } else {
                console.log('No data found for tab: ' + requestData.tab);
                sendResponse({ error: "No data to send" });
            }
        } else {
            console.log("No handshake found");
            sendResponse({ error: "No handshake found" });
        }
    }
);
