import { useEffect, useState } from "react";
import { validateInvitation, type StoredInvite } from "@webjourney/journey-schema";

export function Popup() {
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentHost, setCurrentHost] = useState<string>("");
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [activeMode, setActiveMode] = useState<"author" | "learner">("author");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        const url = tabs[0].url;
        setCurrentUrl(url);
        setActiveTabId(tabs[0].id || null);
        try {
          setCurrentHost(new URL(url).hostname);
        } catch {
          setCurrentHost(url);
        }
      }
    });
  }, []);

  const openSidePanel = async () => {
    if (activeTabId) {
      await chrome.sidePanel.open({ tabId: activeTabId });
      window.close();
    }
  };

  const redeemInvite = () => {
    const code = inviteCodeInput.trim().toUpperCase();
    if (!code) {
      setStatusMessage({ text: "Please enter a share code.", type: "error" });
      return;
    }

    if (!chrome.storage?.local) {
      setStatusMessage({ text: "Storage not accessible in browser.", type: "error" });
      return;
    }

    chrome.storage.local.get(["webjourney_invitations"], (res) => {
      const invites: Record<string, StoredInvite> = res.webjourney_invitations || {};
      const foundInvite = invites[code];

      if (!foundInvite) {
        setStatusMessage({ text: "Invitation code not found. Please check and try again.", type: "error" });
        return;
      }

      const validation = validateInvitation(foundInvite);
      if (!validation.valid) {
        setStatusMessage({ text: validation.error || "Invitation expired or invalid.", type: "error" });
        return;
      }

      const journey = foundInvite.journeySnapshot;
      const origin = new URL(journey.startUrl).origin;

      // Always persist active run so content script can resume immediately
      chrome.storage.local.set({
        webjourney_active_run: {
          journey,
          currentStepIndex: 0,
          status: "active"
        }
      }, () => {
        if (currentUrl && !currentUrl.startsWith(origin)) {
          setStatusMessage({ text: `Navigating to ${origin} to launch walkthrough...`, type: "info" });
          if (activeTabId) {
            chrome.tabs.update(activeTabId, { url: journey.startUrl }, () => {
              window.close();
            });
          }
          return;
        }

        setStatusMessage({ text: `Launching "${journey.name}"...`, type: "success" });

        if (activeTabId) {
          chrome.tabs.sendMessage(activeTabId, {
            type: "PLAYER_START",
            journey
          }, () => {
            window.close();
          });
        }
      });
    });
  };

  return (
    <div style={{ width: "320px", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Colorful Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #312e81 0%, #1e40af 50%, #2563eb 100%)",
          color: "#ffffff",
          padding: "16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "14px",
                border: "1px solid rgba(255, 255, 255, 0.3)"
              }}
            >
              WJ
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>WebJourney</h2>
              <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.8)" }}>Interactive Guidance</span>
            </div>
          </div>

          {/* Mode Selector */}
          <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.15)", borderRadius: "8px", padding: "2px" }}>
            <button
              onClick={() => setActiveMode("author")}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: activeMode === "author" ? "#ffffff" : "transparent",
                color: activeMode === "author" ? "#1e40af" : "#ffffff",
                fontWeight: 700
              }}
            >
              Author
            </button>
            <button
              onClick={() => setActiveMode("learner")}
              style={{
                padding: "4px 8px",
                fontSize: "11px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: activeMode === "learner" ? "#ffffff" : "transparent",
                color: activeMode === "learner" ? "#1e40af" : "#ffffff",
                fontWeight: 700
              }}
            >
              Learner
            </button>
          </div>
        </div>
      </header>

      {/* Body Content */}
      <div style={{ padding: "16px" }}>
        {statusMessage && (
          <div
            style={{
              padding: "8px 12px",
              background: statusMessage.type === "success" ? "#ecfdf5" : statusMessage.type === "error" ? "#fef2f2" : "#eff6ff",
              border: `1px solid ${statusMessage.type === "success" ? "#a7f3d0" : statusMessage.type === "error" ? "#fecaca" : "#bfdbfe"}`,
              color: statusMessage.type === "success" ? "#065f46" : statusMessage.type === "error" ? "#991b1b" : "#1e40af",
              fontSize: "12px",
              borderRadius: "6px",
              marginBottom: "14px"
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {activeMode === "author" ? (
          <div>
            <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Active Website
                </span>
                <span style={{ fontSize: "10px", background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: "8px", fontWeight: 700 }}>
                  ● Connected
                </span>
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {currentHost || "Detecting active tab..."}
              </div>
            </div>

            <button
              onClick={openSidePanel}
              style={{
                width: "100%",
                padding: "11px",
                background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 4px 10px rgba(79, 70, 229, 0.3)"
              }}
            >
              Open Journey Studio &rarr;
            </button>
          </div>
        ) : (
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e293b", marginBottom: "6px" }}>
              Enter Share Code
            </label>
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="e.g. WJ-8F4A2C"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontFamily: "monospace",
                  fontWeight: 800,
                  fontSize: "14px",
                  outline: "none",
                  letterSpacing: "1px"
                }}
              />
              <button
                onClick={redeemInvite}
                style={{
                  padding: "9px 16px",
                  background: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "13px",
                  boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                }}
              >
                Start
              </button>
            </div>
            <p style={{ fontSize: "11px", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
              💡 Paste the code shared by your trainer or author to begin interactive guided steps on this website.
            </p>
            <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px dashed #cbd5e1" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                Preloaded Demo Code:
              </div>
              <button
                onClick={() => setInviteCodeInput("WJ-CODEVIOSO")}
                style={{
                  fontSize: "11px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  cursor: "pointer",
                  fontWeight: 700
                }}
              >
                🌐 WJ-CODEVIOSO (codevioso.com)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
