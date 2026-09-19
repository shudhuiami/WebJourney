import { useEffect, useState, useRef } from "react";
import {
  createEmptyJourney,
  createDefaultStep,
  validateJourney,
  type Journey,
  type StepDefinition,
  type StepActionType
} from "@webjourney/journey-schema";
import { sendTabMessage } from "../messaging";

const STORAGE_KEY = "webjourney_local_draft";

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<{ id?: number; url?: string; title?: string }>({});
  const [isInspecting, setIsInspecting] = useState(false);
  const [currentJourney, setCurrentJourney] = useState<Journey>(() =>
    createEmptyJourney("My Guided Journey", "http://localhost:5173")
  );
  const [editingStep, setEditingStep] = useState<StepDefinition | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{
    selector: string;
    tagName: string;
    textContent?: string;
    candidatesCount: number;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load draft from chrome.storage.local on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const url = tabs[0].url || "";
        setActiveTab({ id: tabs[0].id, url, title: tabs[0].title });
      }
    });

    if (chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY], (res) => {
        if (res[STORAGE_KEY]) {
          const validated = validateJourney(res[STORAGE_KEY]);
          if (validated.valid && validated.journey) {
            setCurrentJourney(validated.journey);
          }
        }
      });
    }

    const listener = (message: any) => {
      if (message.type === "ELEMENT_PICKED") {
        setSelectedTarget({
          selector: message.selector,
          tagName: message.tagName,
          textContent: message.textContent,
          candidatesCount: message.candidatesCount || 1
        });
        setIsInspecting(false);
        setStatusMessage("Target captured! You can now add or update a journey step.");
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Save draft whenever journey changes
  const saveJourney = (updated: Journey) => {
    setCurrentJourney(updated);
    if (chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: updated });
    }
  };

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

  const testHighlight = async (step?: StepDefinition) => {
    if (!activeTab.id) return;
    const selector = step?.target?.selectorCandidates[0] || selectedTarget?.selector;
    if (!selector) return;

    await sendTabMessage(activeTab.id, {
      type: "HIGHLIGHT_TARGET",
      selector,
      step
    });
  };

  const clearHighlight = async () => {
    if (!activeTab.id) return;
    await sendTabMessage(activeTab.id, { type: "CLEAR_HIGHLIGHT" });
  };

  const addStepFromTarget = () => {
    if (!selectedTarget) return;

    const newStep: StepDefinition = {
      ...createDefaultStep(currentJourney.steps.length),
      title: `Step ${currentJourney.steps.length + 1}: ${selectedTarget.tagName.toUpperCase()}`,
      instruction: `Interact with the highlighted ${selectedTarget.tagName} element to continue.`,
      action: selectedTarget.tagName === "input" || selectedTarget.tagName === "textarea" ? "field-complete" : "click",
      target: {
        selectorCandidates: [selectedTarget.selector],
        tagName: selectedTarget.tagName,
        textContentSnippet: selectedTarget.textContent
      }
    };

    saveJourney({
      ...currentJourney,
      steps: [...currentJourney.steps, newStep],
      updatedAt: new Date().toISOString()
    });

    setEditingStep(newStep);
    setStatusMessage(`Step added! You can customize its title and instructions below.`);
  };

  const saveEditedStep = (updated: StepDefinition) => {
    const updatedSteps = currentJourney.steps.map((s) => (s.id === updated.id ? updated : s));
    saveJourney({
      ...currentJourney,
      steps: updatedSteps,
      updatedAt: new Date().toISOString()
    });
    setEditingStep(null);
    setStatusMessage("Step changes saved.");
  };

  const removeStep = (id: string) => {
    const remaining = currentJourney.steps
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, order: idx }));
    saveJourney({
      ...currentJourney,
      steps: remaining,
      updatedAt: new Date().toISOString()
    });
    if (editingStep?.id === id) setEditingStep(null);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentJourney.steps.length) return;

    const reordered = [...currentJourney.steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const reindexed = reordered.map((s, i) => ({ ...s, order: i }));
    saveJourney({
      ...currentJourney,
      steps: reindexed,
      updatedAt: new Date().toISOString()
    });
  };

  const exportJourneyJSON = () => {
    const blob = new Blob([JSON.stringify(currentJourney, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentJourney.name.toLowerCase().replace(/\s+/g, "_")}_v1.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJourneyJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const validated = validateJourney(parsed);
        if (validated.valid && validated.journey) {
          saveJourney(validated.journey);
          setStatusMessage("Journey successfully imported!");
        } else {
          setStatusMessage(`Import failed: ${validated.errors.join(", ")}`);
        }
      } catch (err: any) {
        setStatusMessage(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const runFullJourney = async () => {
    if (!activeTab.id || currentJourney.steps.length === 0) {
      setStatusMessage("Add at least 1 step before running walkthrough.");
      return;
    }
    await sendTabMessage(activeTab.id, {
      type: "PLAYER_START",
      journey: currentJourney
    });
    setStatusMessage("Walkthrough launched on page! Follow the highlights.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>
      {/* Top Header */}
      <header style={{ padding: "12px 16px", background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
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
            <input
              type="text"
              value={currentJourney.name}
              onChange={(e) => saveJourney({ ...currentJourney, name: e.target.value })}
              style={{
                border: "none",
                fontWeight: 700,
                fontSize: "14px",
                color: "#0f172a",
                width: "140px",
                outline: "none"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={runFullJourney}
              style={{ padding: "4px 8px", fontSize: "11px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 600 }}
            >
              ▶ Play
            </button>
            <button
              onClick={exportJourneyJSON}
              title="Export JSON"
              style={{ padding: "4px 8px", fontSize: "11px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
            >
              Export
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import JSON"
              style={{ padding: "4px 8px", fontSize: "11px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", cursor: "pointer" }}
            >
              Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={importJourneyJSON}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ padding: "14px", flex: 1, overflowY: "auto" }}>
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

        {/* Visual Element Picker Section */}
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>Visual Target Picker</h3>
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
                  &lt;{selectedTarget.tagName}&gt;
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color: selectedTarget.candidatesCount === 1 ? "#16a34a" : "#ea580c"
                  }}
                >
                  {selectedTarget.candidatesCount === 1 ? "✓ Unique Target" : `⚠ ${selectedTarget.candidatesCount} Targets`}
                </span>
              </div>

              <code style={{ display: "block", fontSize: "11px", background: "#ffffff", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0", margin: "6px 0", wordBreak: "break-all" }}>
                {selectedTarget.selector}
              </code>

              <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                <button
                  onClick={() => testHighlight()}
                  style={{ flex: 1, padding: "6px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  Highlight Target
                </button>
                <button
                  onClick={clearHighlight}
                  style={{ padding: "6px 10px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "11px", color: "#64748b", cursor: "pointer" }}
                >
                  Clear
                </button>
                <button
                  onClick={addStepFromTarget}
                  style={{ flex: 1.2, padding: "6px", background: "#10b981", color: "#ffffff", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                >
                  + Add Step
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
              Click <strong>Pick Element</strong> then click any button, link, or input on the page.
            </p>
          )}
        </div>

        {/* Step Customizer Modal / Inline Drawer */}
        {editingStep && (
          <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "2px solid #2563eb", marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#1e40af" }}>
                Edit Step #{editingStep.order + 1}
              </h4>
              <button
                onClick={() => setEditingStep(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Step Title
                </label>
                <input
                  type="text"
                  value={editingStep.title}
                  onChange={(e) => setEditingStep({ ...editingStep, title: e.target.value })}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Guidance Instruction
                </label>
                <textarea
                  rows={2}
                  value={editingStep.instruction}
                  onChange={(e) => setEditingStep({ ...editingStep, instruction: e.target.value })}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Action Type
                  </label>
                  <select
                    value={editingStep.action}
                    onChange={(e) => setEditingStep({ ...editingStep, action: e.target.value as StepActionType })}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  >
                    <option value="click">Click</option>
                    <option value="field-complete">Field Complete</option>
                    <option value="navigation">Navigation</option>
                    <option value="manual">Manual Continue</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Allow Skip
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", height: "30px", fontSize: "12px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editingStep.allowSkip}
                      onChange={(e) => setEditingStep({ ...editingStep, allowSkip: e.target.checked })}
                    />
                    <span>Learner can skip</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <button
                  onClick={() => testHighlight(editingStep)}
                  style={{ flex: 1, padding: "6px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                >
                  Preview on Page
                </button>
                <button
                  onClick={() => saveEditedStep(editingStep)}
                  style={{ flex: 1, padding: "6px", background: "#2563eb", color: "#ffffff", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                >
                  Save Step
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Steps Backlog */}
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>
              Journey Steps ({currentJourney.steps.length})
            </h3>
            <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>● Auto-saved</span>
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
                    background: editingStep?.id === step.id ? "#eff6ff" : "#f8fafc",
                    borderRadius: "6px",
                    border: editingStep?.id === step.id ? "1px solid #93c5fd" : "1px solid #e2e8f0"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px", fontWeight: 700 }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "12px", color: "#0f172a" }}>
                        {step.title}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        disabled={idx === 0}
                        onClick={() => moveStep(idx, "up")}
                        style={{ border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "11px" }}
                      >
                        ▲
                      </button>
                      <button
                        disabled={idx === currentJourney.steps.length - 1}
                        onClick={() => moveStep(idx, "down")}
                        style={{ border: "none", background: "none", cursor: idx === currentJourney.steps.length - 1 ? "default" : "pointer", opacity: idx === currentJourney.steps.length - 1 ? 0.3 : 1, fontSize: "11px" }}
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => setEditingStep(step)}
                        style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeStep(step.id)}
                        style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: "4px 0 6px", fontSize: "11px", color: "#475569" }}>
                    {step.instruction}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: "3px", fontWeight: 700 }}>
                      {step.action}
                    </span>
                    <button
                      onClick={() => testHighlight(step)}
                      style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", cursor: "pointer", fontWeight: 600 }}
                    >
                      Preview &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
