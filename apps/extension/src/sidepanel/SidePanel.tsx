import { useEffect, useState } from "react";

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<{ id?: number; url?: string; title?: string }>({});
  const [isInspecting, setIsInspecting] = useState(false);
  const [lastSelectedTarget, setLastSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    // Query current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        setActiveTab({ id: tabs[0].id, url: tabs[0].url, title: tabs[0].title });
      }
    });

    // Listen for selected element events from content script
    const listener = (message: any) => {
      if (message.type === "ELEMENT_PICKED") {
        setLastSelectedTarget(message.selector);
        setIsInspecting(false);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const toggleInspector = async () => {
    if (!activeTab.id) return;
    const nextState = !isInspecting;
    setIsInspecting(nextState);

    await chrome.tabs.sendMessage(activeTab.id, {
      type: nextState ? "START_INSPECTOR" : "STOP_INSPECTOR"
    });
  };

  const testHighlight = async () => {
    if (!activeTab.id) return;
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "TEST_HIGHLIGHT",
      selector: lastSelectedTarget || "button, a, input"
    });
  };

  const clearHighlight = async () => {
    if (!activeTab.id) return;
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "CLEAR_HIGHLIGHT"
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", boxSizing: "border-box" }}>
      {/* Header */}
      <header style={{ padding: "16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>WebJourney Builder</h2>
          <span style={{ fontSize: "11px", background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: "12px", fontWeight: 600 }}>
            MVP Shell
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#64748b" }}>
          Target: <code>{activeTab.title || activeTab.url || "Detecting tab..."}</code>
        </p>
      </header>

      {/* Main Content */}
      <main style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: "14px", fontWeight: 600 }}>Interactive Element Inspector</h3>
          <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 12px" }}>
            Test element picking and isolated overlay injection directly on the current tab.
          </p>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={toggleInspector}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background: isInspecting ? "#ef4444" : "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              {isInspecting ? "Stop Picking" : "🎯 Pick Element"}
            </button>
            <button
              onClick={testHighlight}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Highlight
            </button>
            <button
              onClick={clearHighlight}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#64748b",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              Clear
            </button>
          </div>

          {lastSelectedTarget && (
            <div style={{ marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                Selected Target Selector:
              </span>
              <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#0f172a", marginTop: "4px", wordBreak: "break-all" }}>
                {lastSelectedTarget}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600 }}>Draft Journeys</h3>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            No drafts saved locally yet. Use the element picker to start authoring steps.
          </p>
        </div>
      </main>
    </div>
  );
}
