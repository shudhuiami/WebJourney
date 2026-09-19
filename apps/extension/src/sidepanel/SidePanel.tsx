import { useEffect, useState, useRef } from "react";
import {
  createEmptyJourney,
  createDefaultStep,
  validateJourney,
  createPublishedVersion,
  createInvitationRecord,
  type Journey,
  type StepDefinition,
  type StepActionType,
  type StoredInvite
} from "@webjourney/journey-schema";
import { sendTabMessage } from "../messaging";

const STORAGE_KEY = "webjourney_local_draft";

const ACTION_METADATA: Record<StepActionType, { label: string; icon: string; bg: string; text: string; border: string }> = {
  click: { label: "Click Action", icon: "👆", bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  "field-complete": { label: "Type Field", icon: "⌨️", bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  navigation: { label: "Navigate URL", icon: "🧭", bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  manual: { label: "Manual Continue", icon: "ℹ️", bg: "#fffbeb", text: "#b45309", border: "#fde68a" }
};

const CODEVIOSO_SAMPLE_JOURNEY: Journey = {
  schemaVersion: 1,
  id: "11111111-2222-3333-4444-555555555555",
  name: "Codevioso Website Onboarding Tour",
  description: "Interactive guided tour of Codevioso web services, digital products, and contact channels.",
  allowedOrigins: ["https://codevioso.com"],
  startUrl: "https://codevioso.com/",
  createdAt: "2026-09-19T12:00:00.000Z",
  updatedAt: "2026-09-19T12:00:00.000Z",
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
      instruction: "Review engineering expertise across web applications, scalable APIs, and bespoke systems.",
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
      instruction: "Discover proprietary turnkey solutions and digital accelerators designed for businesses.",
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
      title: "Connect & Get in Touch",
      instruction: "Reach out directly to kickstart your project or request a comprehensive architecture review.",
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
};

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<{ id?: number; url?: string; title?: string }>({});
  const [activeView, setActiveView] = useState<"builder" | "publish">("builder");
  const [isInspecting, setIsInspecting] = useState(false);
  const [currentJourney, setCurrentJourney] = useState<Journey>(() =>
    createEmptyJourney("My Guided Journey", "http://localhost:5173")
  );
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<{
    selector: string;
    tagName: string;
    textContent?: string;
    candidatesCount: number;
    breadcrumb?: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);
  const [publishedInvite, setPublishedInvite] = useState<StoredInvite | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load draft from chrome.storage.local on mount
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const url = tabs[0].url || "";
        setActiveTab({ id: tabs[0].id, url, title: tabs[0].title });

        try {
          const origin = new URL(url).origin;
          if (origin.startsWith("http")) {
            setCurrentJourney((prev) => {
              if (prev.allowedOrigins[0] === "http://localhost:5173" && prev.steps.length === 0) {
                return {
                  ...prev,
                  name: `${tabs[0].title ? tabs[0].title.slice(0, 30) : "Website"} Walkthrough`,
                  allowedOrigins: [origin],
                  startUrl: url
                };
              }
              return prev;
            });
          }
        } catch {
          // ignore
        }
      }
    });

    if (chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY, "webjourney_invitations"], (res) => {
        if (res[STORAGE_KEY]) {
          const validated = validateJourney(res[STORAGE_KEY]);
          if (validated.valid && validated.journey) {
            setCurrentJourney(validated.journey);
          }
        }
        if (res.webjourney_invitations) {
          const codes = Object.keys(res.webjourney_invitations);
          if (codes.length > 0) {
            setPublishedInvite(res.webjourney_invitations[codes[codes.length - 1]]);
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
          candidatesCount: message.candidatesCount || 1,
          breadcrumb: message.breadcrumb
        });
        setIsInspecting(false);
        setStatusMessage({
          text: `Target captured: <${message.tagName}> in section "${message.breadcrumb || "DOM"}"`,
          type: "success"
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

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
      setStatusMessage({ text: `Inspector error: ${res.error}`, type: "error" });
    } else if (nextState) {
      setStatusMessage({ text: "Hover over any element on the page and click to select it.", type: "info" });
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

    const actionType: StepActionType =
      selectedTarget.tagName === "input" || selectedTarget.tagName === "textarea"
        ? "field-complete"
        : "click";

    const newStep: StepDefinition = {
      ...createDefaultStep(currentJourney.steps.length),
      title: `${selectedTarget.tagName === "button" ? "Click" : "Interact with"} ${selectedTarget.textContent?.slice(0, 24) || selectedTarget.tagName}`,
      instruction: `Click or interact with the highlighted ${selectedTarget.tagName} to continue.`,
      action: actionType,
      target: {
        selectorCandidates: [selectedTarget.selector],
        tagName: selectedTarget.tagName,
        textContentSnippet: selectedTarget.textContent
      }
    };

    const updated = {
      ...currentJourney,
      steps: [...currentJourney.steps, newStep],
      updatedAt: new Date().toISOString()
    };
    saveJourney(updated);
    setEditingStepId(newStep.id);
    setSelectedTarget(null);
    setStatusMessage({ text: `Step #${updated.steps.length} created! You can edit instructions below.`, type: "success" });
  };

  const updateStep = (stepId: string, patch: Partial<StepDefinition>) => {
    const updated = currentJourney.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
    saveJourney({
      ...currentJourney,
      steps: updated,
      updatedAt: new Date().toISOString()
    });
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
    if (editingStepId === id) setEditingStepId(null);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentJourney.steps.length) return;

    const reordered = [...currentJourney.steps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    saveJourney({
      ...currentJourney,
      steps: reordered.map((s, i) => ({ ...s, order: i })),
      updatedAt: new Date().toISOString()
    });
  };

  const runFullJourney = async () => {
    if (!activeTab.id || currentJourney.steps.length === 0) {
      setStatusMessage({ text: "Add at least one step before playing the walkthrough.", type: "error" });
      return;
    }
    await sendTabMessage(activeTab.id, {
      type: "PLAYER_START",
      journey: currentJourney
    });
    setStatusMessage({ text: "Walkthrough launched on page! Follow the highlights.", type: "success" });
  };

  const publishCurrentJourney = () => {
    if (currentJourney.steps.length === 0) {
      setStatusMessage({ text: "Add at least one step before publishing.", type: "error" });
      return;
    }

    const version = createPublishedVersion(currentJourney, 1);
    const invite = createInvitationRecord(version, 30);

    if (chrome.storage?.local) {
      chrome.storage.local.get(["webjourney_invitations", "webjourney_published_versions"], (res) => {
        const currentInvites = res.webjourney_invitations || {};
        const currentVersions = res.webjourney_published_versions || [];

        currentInvites[invite.code] = invite;
        currentVersions.push(version);

        chrome.storage.local.set(
          {
            webjourney_invitations: currentInvites,
            webjourney_published_versions: currentVersions
          },
          () => {
            setPublishedInvite(invite);
            setActiveView("publish");
            setStatusMessage({ text: `Version 1 published! Share code: ${invite.code}`, type: "success" });
          }
        );
      });
    } else {
      setPublishedInvite(invite);
      setActiveView("publish");
    }
  };

  const exportJourneyJSON = () => {
    const blob = new Blob([JSON.stringify(currentJourney, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentJourney.name.toLowerCase().replace(/\s+/g, "_")}.json`;
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
          setStatusMessage({ text: "Journey imported successfully!", type: "success" });
        } else {
          setStatusMessage({ text: `Import error: ${validated.errors.join(", ")}`, type: "error" });
        }
      } catch (err: any) {
        setStatusMessage({ text: `Invalid JSON file: ${err.message}`, type: "error" });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f1f5f9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* Vibrant Gradient Header */}
      <header
        style={{
          background: "linear-gradient(135deg, #312e81 0%, #1e40af 50%, #2563eb 100%)",
          color: "#ffffff",
          padding: "16px",
          boxShadow: "0 4px 12px rgba(30, 64, 175, 0.25)"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
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
              <input
                type="text"
                value={currentJourney.name}
                onChange={(e) => saveJourney({ ...currentJourney, name: e.target.value })}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px dashed rgba(255,255,255,0.4)",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  outline: "none",
                  width: "160px"
                }}
                placeholder="Walkthrough Title"
              />
              <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.8)", marginTop: "2px" }}>
                {currentJourney.steps.length} Steps configured
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={runFullJourney}
              style={{
                background: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 2px 6px rgba(16, 185, 129, 0.4)"
              }}
            >
              ▶ Play
            </button>
            <button
              onClick={publishCurrentJourney}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.4)",
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              🚀 Share
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
          <button
            onClick={() => setActiveView("builder")}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              border: "none",
              background: activeView === "builder" ? "#ffffff" : "rgba(255,255,255,0.15)",
              color: activeView === "builder" ? "#1e3a8a" : "#ffffff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            <span>✍️ Steps Builder</span>
            <span
              style={{
                background: activeView === "builder" ? "#dbeafe" : "rgba(255,255,255,0.3)",
                color: activeView === "builder" ? "#1e40af" : "#ffffff",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "10px"
              }}
            >
              {currentJourney.steps.length}
            </span>
          </button>
          <button
            onClick={() => setActiveView("publish")}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "6px",
              border: "none",
              background: activeView === "publish" ? "#ffffff" : "rgba(255,255,255,0.15)",
              color: activeView === "publish" ? "#1e3a8a" : "#ffffff",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px"
            }}
          >
            <span>🚀 Publish & Invites</span>
            {publishedInvite && (
              <span style={{ background: "#10b981", color: "#ffffff", padding: "1px 5px", borderRadius: "10px", fontSize: "10px" }}>
                ✓
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ padding: "14px", flex: 1, overflowY: "auto" }}>
        {/* Status Toast */}
        {statusMessage && (
          <div
            style={{
              padding: "10px 14px",
              background:
                statusMessage.type === "success" ? "#ecfdf5" : statusMessage.type === "error" ? "#fef2f2" : "#eff6ff",
              border: `1px solid ${
                statusMessage.type === "success" ? "#a7f3d0" : statusMessage.type === "error" ? "#fecaca" : "#bfdbfe"
              }`,
              color:
                statusMessage.type === "success" ? "#065f46" : statusMessage.type === "error" ? "#991b1b" : "#1e40af",
              fontSize: "12px",
              borderRadius: "8px",
              marginBottom: "14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
            }}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "inherit" }}
            >
              &times;
            </button>
          </div>
        )}

        {activeView === "builder" ? (
          <div>
            {/* Active Website & Quick Preset Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: "#ffffff",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginBottom: "12px",
                fontSize: "11px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                <span style={{ color: "#64748b" }}>Target Site:</span>
                <span
                  style={{
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    maxWidth: "130px"
                  }}
                  title={currentJourney.allowedOrigins[0] || ""}
                >
                  {currentJourney.allowedOrigins[0] ? new URL(currentJourney.allowedOrigins[0]).hostname : "Unset"}
                </span>
              </div>
              <button
                onClick={() => {
                  saveJourney(CODEVIOSO_SAMPLE_JOURNEY);
                  setStatusMessage({ text: "Codevioso.com sample tour loaded! Click 'Play' to test on codevioso.com.", type: "success" });
                }}
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px solid #bbf7d0",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                ⚡ Load codevioso.com Tour
              </button>
            </div>

            {/* Step 1: Big Action Picker Bar */}
            <div
              style={{
                background: "#ffffff",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                marginBottom: "14px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    🎯 Step 1: Select Target on Page
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#64748b" }}>
                    Hover over buttons, inputs, or sections on the live website.
                  </p>
                </div>
                <button
                  onClick={toggleInspector}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: isInspecting
                      ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                      : "linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    boxShadow: isInspecting
                      ? "0 0 0 3px rgba(239, 68, 68, 0.3)"
                      : "0 4px 10px rgba(79, 70, 229, 0.3)",
                    transition: "all 0.15s ease"
                  }}
                >
                  {isInspecting ? "✕ Stop Picking" : "🔍 Pick Element"}
                </button>
              </div>

              {/* Captured Target Detail Card */}
              {selectedTarget && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    background: "#f0fdf4",
                    border: "1.5px solid #86efac",
                    borderRadius: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "6px", fontWeight: 700 }}>
                        &lt;{selectedTarget.tagName}&gt;
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#166534" }}>
                        ✓ Unique Target Identified
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "#15803d" }}>
                      Matches: <strong>1 element</strong>
                    </span>
                  </div>

                  {selectedTarget.breadcrumb && (
                    <div style={{ fontSize: "11px", color: "#374151", margin: "6px 0 4px", fontWeight: 500 }}>
                      Section: <strong>{selectedTarget.breadcrumb}</strong>
                    </div>
                  )}

                  <code style={{ display: "block", fontSize: "11px", background: "#ffffff", padding: "6px 8px", borderRadius: "4px", border: "1px solid #bbf7d0", margin: "6px 0", wordBreak: "break-all", color: "#1e3a8a" }}>
                    {selectedTarget.selector}
                  </code>

                  <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                    <button
                      onClick={() => testHighlight()}
                      style={{
                        flex: 1,
                        padding: "7px 10px",
                        background: "#ffffff",
                        border: "1px solid #86efac",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#166534",
                        cursor: "pointer"
                      }}
                    >
                      👁️ Test Highlight
                    </button>
                    <button
                      onClick={addStepFromTarget}
                      style={{
                        flex: 1.5,
                        padding: "7px 12px",
                        background: "#10b981",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#ffffff",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                      }}
                    >
                      + Add as Step #{currentJourney.steps.length + 1}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Configured Steps List */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 2px 8px" }}>
              <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                Walkthrough Steps ({currentJourney.steps.length})
              </h3>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={exportJourneyJSON}
                  style={{ fontSize: "11px", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}
                >
                  Export JSON
                </button>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: "11px", background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 600 }}
                >
                  Import
                </button>
                <input type="file" ref={fileInputRef} accept=".json" onChange={importJourneyJSON} style={{ display: "none" }} />
              </div>
            </div>

            {currentJourney.steps.length === 0 ? (
              <div
                style={{
                  background: "#ffffff",
                  padding: "32px 20px",
                  borderRadius: "10px",
                  border: "2px dashed #cbd5e1",
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</div>
                <h4 style={{ margin: "0 0 6px", fontSize: "14px", color: "#0f172a" }}>No steps added yet</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                  Click <strong>Pick Element</strong> above, then click any button or field on the page to build your walkthrough.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {currentJourney.steps.map((step, idx) => {
                  const meta = ACTION_METADATA[step.action] || ACTION_METADATA.click;
                  const isEditing = editingStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      style={{
                        background: "#ffffff",
                        borderRadius: "10px",
                        border: isEditing ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                        boxShadow: isEditing ? "0 6px 16px rgba(59, 130, 246, 0.15)" : "0 1px 3px rgba(0,0,0,0.03)",
                        overflow: "hidden",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {/* Step Summary Bar */}
                      <div
                        style={{
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          background: isEditing ? "#eff6ff" : "#ffffff",
                          borderBottom: isEditing ? "1px solid #bfdbfe" : "none"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, overflow: "hidden" }}>
                          <span
                            style={{
                              width: "22px",
                              height: "22px",
                              background: "#3b82f6",
                              color: "#ffffff",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: "11px",
                              flexShrink: 0
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {step.title}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: meta.bg,
                              color: meta.text,
                              border: `1px solid ${meta.border}`,
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }}
                          >
                            {meta.icon} {step.action}
                          </span>
                          <button
                            disabled={idx === 0}
                            onClick={() => moveStep(idx, "up")}
                            style={{ border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "11px", padding: "2px 4px" }}
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === currentJourney.steps.length - 1}
                            onClick={() => moveStep(idx, "down")}
                            style={{ border: "none", background: "none", cursor: idx === currentJourney.steps.length - 1 ? "default" : "pointer", opacity: idx === currentJourney.steps.length - 1 ? 0.3 : 1, fontSize: "11px", padding: "2px 4px" }}
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => setEditingStepId(isEditing ? null : step.id)}
                            style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontSize: "12px", fontWeight: 700, padding: "2px 6px" }}
                          >
                            {isEditing ? "Done" : "Edit"}
                          </button>
                          <button
                            onClick={() => removeStep(step.id)}
                            style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px", padding: "2px 4px" }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Expandable Step Editor */}
                      {isEditing ? (
                        <div style={{ padding: "14px", background: "#ffffff", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                              Step Title
                            </label>
                            <input
                              type="text"
                              value={step.title}
                              onChange={(e) => updateStep(step.id, { title: e.target.value })}
                              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                              Instruction for Learner
                            </label>
                            <textarea
                              rows={2}
                              value={step.instruction}
                              onChange={(e) => updateStep(step.id, { instruction: e.target.value })}
                              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                            />
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                                Action Type
                              </label>
                              <select
                                value={step.action}
                                onChange={(e) => updateStep(step.id, { action: e.target.value as StepActionType })}
                                style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                              >
                                <option value="click">👆 Click Target</option>
                                <option value="field-complete">⌨️ Type / Field Complete</option>
                                <option value="navigation">🧭 Navigate Route</option>
                                <option value="manual">ℹ️ Manual Continue</option>
                              </select>
                            </div>

                            <div style={{ flex: 1 }}>
                              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                                Learner Control
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", fontSize: "12px", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={step.allowSkip}
                                  onChange={(e) => updateStep(step.id, { allowSkip: e.target.checked })}
                                />
                                <span>Allow Skip</span>
                              </label>
                            </div>
                          </div>

                          {step.target && (
                            <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                                Target Selector:
                              </span>
                              <code style={{ display: "block", fontSize: "10px", color: "#1e40af", marginTop: "2px", wordBreak: "break-all" }}>
                                {step.target.selectorCandidates[0]}
                              </code>
                            </div>
                          )}

                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            <button
                              onClick={() => testHighlight(step)}
                              style={{
                                flex: 1,
                                padding: "7px",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                borderRadius: "6px",
                                color: "#1d4ed8",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer"
                              }}
                            >
                              👁️ Test on Page
                            </button>
                            <button
                              onClick={clearHighlight}
                              style={{
                                padding: "7px 12px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                color: "#64748b",
                                fontSize: "12px",
                                cursor: "pointer"
                              }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "8px 14px 10px", fontSize: "12px", color: "#475569" }}>
                          <p style={{ margin: "0 0 6px", lineHeight: 1.4 }}>{step.instruction}</p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <code style={{ fontSize: "10px", color: "#64748b" }}>
                              {step.target?.selectorCandidates[0]?.slice(0, 35)}...
                            </code>
                            <button
                              onClick={() => testHighlight(step)}
                              style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                            >
                              Preview &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Publish & Share View */
          <div>
            <div
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                padding: "20px",
                borderRadius: "12px",
                boxShadow: "0 8px 16px rgba(16, 185, 129, 0.25)",
                marginBottom: "16px"
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: "10px" }}>
                Publishing Center
              </span>
              <h3 style={{ margin: "10px 0 4px", fontSize: "18px", fontWeight: 800 }}>
                {currentJourney.name}
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>
                Publish an immutable version snapshot. Learners can run this journey using a share code.
              </p>

              <button
                onClick={publishCurrentJourney}
                style={{
                  background: "#ffffff",
                  color: "#065f46",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
                }}
              >
                🚀 Publish Version 1.0
              </button>
            </div>

            {publishedInvite && (
              <div
                style={{
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "10px",
                  border: "1.5px solid #a7f3d0",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.04)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#065f46" }}>
                    Active Share Code
                  </h4>
                  <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>● Active</span>
                </div>

                <div
                  style={{
                    margin: "14px 0",
                    padding: "14px",
                    background: "#f0fdf4",
                    borderRadius: "8px",
                    textAlign: "center",
                    border: "1px dashed #86efac"
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "1px" }}>
                    Invitation Code
                  </span>
                  <div style={{ fontSize: "28px", fontWeight: 900, fontFamily: "monospace", color: "#065f46", letterSpacing: "3px", margin: "6px 0" }}>
                    {publishedInvite.code}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(publishedInvite.code);
                      setStatusMessage({ text: "Share code copied to clipboard!", type: "success" });
                    }}
                    style={{
                      background: "#10b981",
                      color: "#ffffff",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer"
                    }}
                  >
                    📋 Copy Code
                  </button>
                </div>

                <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                  <strong>How to share:</strong> Send this code to any user with the WebJourney extension. They click <strong>Learner Mode</strong> in their extension popup, paste the code, and begin!
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
