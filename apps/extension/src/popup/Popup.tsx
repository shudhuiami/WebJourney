import { useEffect, useState } from "react";
import { validateInvitation, type StoredInvite } from "@webjourney/journey-schema";

export function Popup() {
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [activeMode, setActiveMode] = useState<"author" | "learner">("author");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setCurrentUrl(tabs[0].url);
        setActiveTabId(tabs[0].id || null);
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
    if (!code) return;

    if (!chrome.storage?.local) {
      setStatusMessage("Storage not accessible.");
      return;
    }

    chrome.storage.local.get(["webjourney_invitations"], (res) => {
      const invites: Record<string, StoredInvite> = res.webjourney_invitations || {};
      const foundInvite = invites[code];

      if (!foundInvite) {
        setStatusMessage("Invalid invitation code. Check and try again.");
        return;
      }

      const validation = validateInvitation(foundInvite);
      if (!validation.valid) {
        setStatusMessage(validation.error || "Invitation invalid.");
        return;
      }

      // Check origin permissions
      const journey = foundInvite.journeySnapshot;
      const origin = new URL(journey.startUrl).origin;

      if (currentUrl && !currentUrl.startsWith(origin)) {
        setStatusMessage(`Navigating to ${origin} to begin walkthrough...`);
        if (activeTabId) {
          chrome.tabs.update(activeTabId, { url: journey.startUrl }, () => {
            window.close();
          });
        }
        return;
      }

      setStatusMessage(`Starting "${journey.name}"...`);

      if (activeTabId) {
        // Send PLAYER_START to current tab
        chrome.tabs.sendMessage(activeTabId, {
          type: "PLAYER_START",
          journey
        }, () => {
          window.close();
        });
      }
    });
  };

  return (
    <div style={{ padding: "16px", minWidth: "300px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "#2563eb",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "14px"
            }}
          >
            WJ
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>WebJourney</h2>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Interactive Guidance</span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "6px", padding: "2px" }}>
          <button
            onClick={() => setActiveMode("author")}
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              background: activeMode === "author" ? "#ffffff" : "transparent",
              fontWeight: activeMode === "author" ? 600 : 400,
              boxShadow: activeMode === "author" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
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
              borderRadius: "4px",
              cursor: "pointer",
              background: activeMode === "learner" ? "#ffffff" : "transparent",
              fontWeight: activeMode === "learner" ? 600 : 400,
              boxShadow: activeMode === "learner" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
            }}
          >
            Learner
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: "8px", background: "#eff6ff", color: "#1e40af", fontSize: "12px", borderRadius: "6px", marginBottom: "12px" }}>
          {statusMessage}
        </div>
      )}

      {activeMode === "author" ? (
        <div>
          <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 14px" }}>
            Active webpage: <br />
            <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 4px", borderRadius: "4px", wordBreak: "break-all" }}>
              {currentUrl || "No active tab detected"}
            </code>
          </p>

          <button
            onClick={openSidePanel}
            style={{
              width: "100%",
              padding: "10px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "13px"
            }}
          >
            Open Journey Builder &rarr;
          </button>
        </div>
      ) : (
        <div>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
            Enter Invitation Code
          </label>
          <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="e.g. WJ-8F4A2C"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontFamily: "monospace",
                fontWeight: 600,
                fontSize: "13px"
              }}
            />
            <button
              onClick={redeemInvite}
              style={{
                padding: "8px 14px",
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              Start
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>
            Enter a code shared by your trainer or colleague to launch on-page guidance.
          </p>
        </div>
      )}
    </div>
  );
}
