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

// Seed initial demo invites (e.g. Codevioso tour) on install
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.storage?.local) {
    chrome.storage.local.get(["webjourney_invitations"], (res) => {
      const invites = res.webjourney_invitations || {};
      if (!invites["WJ-CODEVIOSO"]) {
        invites["WJ-CODEVIOSO"] = {
          code: "WJ-CODEVIOSO",
          versionId: "11111111-2222-3333-4444-555555555555",
          versionNumber: 1,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
          revoked: false,
          redemptionCount: 0,
          journeySnapshot: {
            schemaVersion: 1,
            id: "11111111-2222-3333-4444-555555555555",
            name: "Codevioso Interactive Tour",
            description: "Guided onboarding for Codevioso bespoke engineering & software services",
            allowedOrigins: ["https://codevioso.com"],
            startUrl: "https://codevioso.com/",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            steps: [
              {
                id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
                order: 0,
                title: "Welcome to Codevioso",
                instruction: "Welcome! Codevioso delivers high-grade software solutions. Click the logo or continue.",
                action: "click",
                target: {
                  selectorCandidates: [
                    "header > div:nth-of-type(1) > a",
                    "#cv-nav a.cv-nav__logo",
                    "header a[href*='codevioso.com']"
                  ],
                  tagName: "a",
                  textContentSnippet: "Codevioso"
                },
                timeoutMs: 30000,
                allowSkip: true
              },
              {
                id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e",
                order: 1,
                title: "Discover Tailored Services",
                instruction: "Click on 'Services' to review full-stack web engineering and cloud architectures.",
                action: "click",
                target: {
                  selectorCandidates: [
                    "header > div:nth-of-type(1) > nav > ul > li:nth-of-type(2) > a",
                    "nav a[href*='services']",
                    "a[href*='/services']"
                  ],
                  tagName: "a",
                  textContentSnippet: "Services"
                },
                timeoutMs: 30000,
                allowSkip: true
              },
              {
                id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f",
                order: 2,
                title: "Explore Software Products",
                instruction: "Check out Codevioso's digital products and turnkey software solutions.",
                action: "click",
                target: {
                  selectorCandidates: [
                    "header > div:nth-of-type(1) > nav > ul > li:nth-of-type(3) > a",
                    "nav a[href*='products']",
                    "a[href*='/products']"
                  ],
                  tagName: "a",
                  textContentSnippet: "Products"
                },
                timeoutMs: 30000,
                allowSkip: true
              },
              {
                id: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
                order: 3,
                title: "Connect & Start a Project",
                instruction: "Reach out directly to kickstart your project or request an engineering consultation.",
                action: "click",
                target: {
                  selectorCandidates: [
                    "header > div:nth-of-type(1) > div > div > a",
                    "header a[href*='contact']",
                    "a[href*='contact']"
                  ],
                  tagName: "a",
                  textContentSnippet: "Contact"
                },
                timeoutMs: 30000,
                allowSkip: true
              }
            ]
          }
        };
        chrome.storage.local.set({ webjourney_invitations: invites });
      }
    });
  }
});

