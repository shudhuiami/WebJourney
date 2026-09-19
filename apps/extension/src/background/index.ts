// WebJourney Background Service Worker (Manifest V3)

console.log("[WebJourney] Background service worker initialized.");

// Enable side panel when extension action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("[WebJourney] Error setting panel behavior:", error));

// Message routing between side panel and content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ status: "PONG", timestamp: Date.now() });
    return true;
  }

  // Relay messages from Side Panel to active tab content script
  if (message.target === "CONTENT_SCRIPT" && message.tabId) {
    chrome.tabs.sendMessage(message.tabId, message, (response) => {
      sendResponse(response);
    });
    return true;
  }

  return false;
});
