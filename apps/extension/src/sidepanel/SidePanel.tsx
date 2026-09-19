import { useEffect, useState } from "react";
import { createEmptyJourney, createDefaultStep, type Journey, type StepDefinition } from "@webjourney/journey-schema";
import { sendTabMessage } from "../messaging";

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<{ id?: number; url?: string; title?: string }>({});
  const [isInspecting, setIsInspecting] = useState(false);
  const [currentJourney, setCurrentJourney] = useState<Journey>(() =>
    createEmptyJourney("My First Guided Tour", "https://localhost:5173")
  );
  const [selectedTarget, setSelectedTarget] = useState<{
    selector: string;
    tagName: string;
    textContent?: string;
    candidatesCount: number;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    // Query active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const url = tabs[0].url || "";
        setActiveTab({ id: tabs[0].id, url, title: tabs[0].title });
        setCurrentJourney((prev) => ({
          ...prev,
          startUrl: url,
          allowedOrigins: [new URL(url || "http://localhost").origin]
        }));
      }
    });

    // Listen for picked elements from content script
    const listener = (message: any) => {
      if (message.type === "ELEMENT_PICKED") {
        setSelectedTarget({
          selector: message.selector,
          tagName: message.tagName,
          textContent: message.textContent,
          candidatesCount: message.candidatesCount || 1
        });
        setIsInspecting(false);
        setStatusMessage("Target captured! You can now add it as a journey step.");
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  const toggleInspector = async () => {
    if (!activeTab.id) return;
    const nextState = !isInspecting;
    setIsInspecting(nextState);

    const res = await sendTabMessage(activeTab.id, {
      type: nextState ? "START_INSPECTOR" : "STOP_INSPECTOR"
    });
    if (!res.success) {
      setStatusMessage(`Error: ${res.error}`);
    }
  };

  const testHighlight = async () => {
    if (!activeTab.id || !selectedTarget) return;
    await sendTabMessage(activeTab.id, {
      type: "HIGHLIGHT_TARGET",
      selector: selectedTarget.selector
    });
  };

  const addStepFromTarget = () => {
    if (!selectedTarget) return;

    const newStep: StepDefinition = {
      ...createDefaultStep(currentJourney.steps.length),
      title: `Interact with ${selectedTarget.tagName}`,
      instruction: `Click on the ${selectedTarget.tagName} element to advance.`,
      action: "click",
      target: {
        selectorCandidates: [selectedTarget.selector],
        tagName: selectedTarget.tagName,
        textContentSnippet: selectedTarget.textContent
      }
    };

    setCurrentJourney((prev) => ({
      ...prev,
      steps: [...prev.steps, newStep],
      updatedAt: new Date().toISOString()
    }));

    setStatusMessage(`Added step ${currentJourney.steps.length + 1} to journey.`);
  };

  const removeStep = (id: string) => {
    setCurrentJourney((prev) => ({
      ...prev,
      steps: prev.steps.filter((s) => s.id !== id).map((s, idx) => ({ ...s, order: idx })),
      updatedAt: new Date().toISOString()
    }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <header style={{ padding: "14px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "24px",
                height: "24px",
                background: "#2563eb",
                borderRadius: "6px",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "12px"
              }}
            >
              WJ
            </div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>WebJourney Builder</h2>
          </div>
          <span style={{ fontSize: "11px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "10px", fontWeight: 600 }}>
            Active
          </span>
        </div>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Target: <code>{activeTab.url || "Connecting..."}</code>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
        {statusMessage && (
          <div
            style={{
              padding: "8px 12px",
              background: "#eff6ff",
              color: "#1e40af",
              fontSize: "12px",
              borderRadius: "6px",
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage("")}
              style={{ background: "none", border: "none", color: "#1e40af", cursor: "pointer", fontSize: "14px" }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Element Inspector Card */}
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Visual Element Inspector</h3>
            <button
              onClick={toggleInspector}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: isInspecting ? "#ef4444" : "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              {isInspecting ? "✕ Stop Picking" : "🎯 Pick Element"}
            </button>
          </div>

          {selectedTarget ? (
            <div style={{ padding: "10px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569" }}>
                  TAG: <code>&lt;{selectedTarget.tagName}&gt;</code>
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: selectedTarget.candidatesCount === 1 ? "#16a34a" : "#ea580c"
                  }}
                >
                  {selectedTarget.candidatesCount === 1 ? "✓ Unique Target" : `⚠ ${selectedTarget.candidatesCount} Ambiguous Targets`}
                </span>
              </div>

              <div style={{ fontFamily: "monospace", fontSize: "11px", background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0", margin: "6px 0", wordBreak: "break-all" }}>
                {selectedTarget.selector}
              </div>

              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button
                  onClick={testHighlight}
                  style={{
                    flex: 1,
                    padding: "6px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Test Highlight
                </button>
                <button
                  onClick={addStepFromTarget}
                  style={{
                    flex: 1,
                    padding: "6px",
                    background: "#10b981",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  + Add to Journey
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              Click <strong>Pick Element</strong> to hover and select any target on the live webpage.
            </p>
          )}
        </div>

        {/* Steps List */}
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>
              Journey Steps ({currentJourney.steps.length})
            </h3>
            <span style={{ fontSize: "11px", color: "#64748b" }}>Draft Mode</span>
          </div>

          {currentJourney.steps.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
              No steps created yet. Pick an element above to build your first step.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {currentJourney.steps.map((step, idx) => (
                <div
                  key={step.id}
                  style={{
                    padding: "10px",
                    background: "#f8fafc",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "12px" }}>
                      {idx + 1}. {step.title}
                    </span>
                    <button
                      onClick={() => removeStep(step.id)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}
                    >
                      Remove
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 6px", fontSize: "11px", color: "#64748b" }}>
                    {step.instruction}
                  </p>
                  {step.target && (
                    <code style={{ fontSize: "10px", background: "#e2e8f0", padding: "2px 4px", borderRadius: "3px" }}>
                      {step.target.selectorCandidates[0]}
                    </code>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
