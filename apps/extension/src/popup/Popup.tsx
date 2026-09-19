import { useEffect, useState } from "react";

export function Popup() {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        setCurrentUrl(tabs[0].url);
      }
    });
  }, []);

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
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
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>WebJourney</h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Interactive Walkthroughs</span>
        </div>
      </div>

      <p style={{ fontSize: "13px", color: "#475569", margin: "8px 0 16px" }}>
        Current page: <br />
        <code style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 4px", borderRadius: "4px", wordBreak: "break-all" }}>
          {currentUrl || "No active tab"}
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
          fontSize: "14px"
        }}
      >
        Open Journey Builder
      </button>
    </div>
  );
}
