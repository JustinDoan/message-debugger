// Send handshake to background script, get data back
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {

    chrome.runtime.sendMessage({
        data: JSON.stringify({ handshake: true, tab: tabs[0].id })
    }, (response) => {
        if (!response || response.error) {
            // Page hasn't finished loading message yet, or something went wrong
            // TODO: Show Message to reopen popup after message loads.
        } else {
            console.log(response);
            let { messages, sdk } = response;
            // Load sdk data
            updateSDKUI(sdk);

            // add each message as a child of the messages div
            messages.forEach((message) => {
                updateMessagesUI(message);
            })
        }

    })

});


function updateSDKUI(sdk) {
    // SDK Elements
    let paypalDebugIdSdkElement = document.getElementById("paypalDebugIdSdk");
    let xCacheSdkElement = document.getElementById("xCacheSdk");
    let xCacheHitsSdkElement = document.getElementById("xCacheHitsSdk");

    paypalDebugIdSdkElement.innerText = sdk.paypalDebugId;
    xCacheSdkElement.style.color = getColorXCache(sdk.xCache);
    xCacheSdkElement.innerText = sdk.xCache;
    xCacheHitsSdkElement.innerText = sdk.xCacheHits;
}

function updateMessagesUI(message) {
    document.getElementById("messages").appendChild(createMessageBoxUI(message));
}


function createMessageBoxUI(message) {
    let messageDiv = document.createElement("div");
    messageDiv.className = "container";
    messageDiv.innerHTML = `
    <h2>Message</h2>
        <div class="infoContainer">
            <div class="key">Amount:</div>
            <div class="value">${message.iframeMessage ? message.iframeMessage.amount : "null"}</div>
        </div>
        <div class="infoContainer">
            <div class="key">PayPal Debug ID:</div>
            <div class="value">${message.paypalDebugId}</div>
        </div>
        <div class="infoContainer">
            <div class="key">X-Cache:</div>
            <div class="value" style="color: ${getColorXCache(message.xCache)};">${message.xCache}</div>
        </div>
            <div class="infoContainer">
            <div class="key">X-Cache-Hits</div>
            <div class="value">${message.xCacheHits}</div>
        </div>
        <div class="infoContainer">
            <div class="key">Merchant Config:</div>
            <div class="value">${message.merchantConfig}</div>
        </div>`

    if (message.iframeMessage) {
        console.log(message.iframeMessage);
        messageDiv.innerHTML += `
        <div class="infoContainer">
            <div class="key">SDK Meta</div>
            <textarea class="value" id="sdkMeta">${atob(message.sdkMeta)}</textarea>
        </div>
        <div class="iframeContainer">
            <h3>IFrame Message</h3>
            <div class="infoContainer">
                <div class="key">PayPal Debug Id</div>
                <div class="value">${message.iframeMessage.paypalDebugId}</div>
            </div>
        </div >`
    }
    return messageDiv;
}


// function to get color to set xCache to
function getColorXCache(xCache) {
    if (xCache === "HIT") {
        return "#00c90a";
    } else if (xCache === "MISS") {
        return "#ff0000";
    }
}

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}


async function highlightMessage() {
    let tab = await getCurrentTab()
    chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        css: `
        @keyframes blink {
            50% {
              border-color: #ff0000;
            }
          }
          
          div[data-pp-id] {
            border: 3px yellow solid;
            animation: blink 0.5s step-end infinite alternate;
          }
            `
    });
}

// add listener to highlight message
document.getElementById("highlightMessage").addEventListener("click", highlightMessage);



