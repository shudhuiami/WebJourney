import { useState, useEffect } from "react";

export function App() {
  const [currentPage, setCurrentPage] = useState<"dashboard" | "projects" | "analytics" | "settings">("dashboard");
  const [projectName, setProjectName] = useState("");
  const [projectCreated, setProjectCreated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [delayedButtonVisible, setDelayedButtonVisible] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState(false);

  // Sync route with URL hash for SPA navigation testing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "");
      if (hash === "projects" || hash === "analytics" || hash === "settings" || hash === "dashboard") {
        setCurrentPage(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    if (!window.location.hash) {
      window.location.hash = "#/dashboard";
    } else {
      handleHashChange();
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (page: "dashboard" | "projects" | "analytics" | "settings") => {
    window.location.hash = `#/${page}`;
    setCurrentPage(page);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      {/* Navigation Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            id="brand-logo"
            data-testid="brand-logo"
            style={{
              width: "36px",
              height: "36px",
              background: "#2563eb",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "16px"
            }}
          >
            WJ
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Acme Cloud Platform</h1>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Interactive Walkthrough Testbed</span>
          </div>
        </div>

        {/* Multi-page Nav for SPA testing */}
        <nav style={{ display: "flex", gap: "8px" }}>
          <button
            id="nav-dashboard"
            data-testid="nav-dashboard"
            onClick={() => navigateTo("dashboard")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "dashboard" ? "#2563eb" : "transparent",
              color: currentPage === "dashboard" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Dashboard
          </button>
          <button
            id="nav-projects"
            data-testid="nav-projects"
            onClick={() => navigateTo("projects")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "projects" ? "#2563eb" : "transparent",
              color: currentPage === "projects" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Projects
          </button>
          <button
            id="nav-analytics"
            data-testid="nav-analytics"
            onClick={() => navigateTo("analytics")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "analytics" ? "#2563eb" : "transparent",
              color: currentPage === "analytics" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Analytics
          </button>
          <button
            id="nav-settings"
            data-testid="nav-settings"
            onClick={() => navigateTo("settings")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "settings" ? "#2563eb" : "transparent",
              color: currentPage === "settings" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: "32px", maxWidth: "1050px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {/* Step Type 4: Manual Continue / Informational Card */}
        <div
          id="welcome-banner"
          data-testid="welcome-banner"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            padding: "16px 20px",
            borderRadius: "8px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "15px", color: "#1e40af" }}>
              💡 Ready for Guided Tour
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#1e3a8a" }}>
              This page contains verified targets for: <strong>Click</strong>, <strong>Field Complete</strong>, <strong>SPA Navigation</strong>, and <strong>Dynamic Re-renders</strong>.
            </p>
          </div>
          <span style={{ fontSize: "12px", background: "#dbeafe", color: "#1e40af", padding: "4px 8px", borderRadius: "4px", fontWeight: 600 }}>
            Route: #{currentPage}
          </span>
        </div>

        {/* Dashboard Tab */}
        {currentPage === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Executive Dashboard</h2>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}>
                  Select elements or click quick actions to test target resolution.
                </p>
              </div>

              <button
                id="btn-open-modal"
                data-testid="btn-open-modal"
                onClick={() => setIsModalOpen(true)}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                + Open Modal Dialog
              </button>
            </div>

            {/* Metric Cards (Click targets) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
              <div
                id="metric-users"
                data-testid="metric-card-users"
                style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>Active Users</span>
                <h3 style={{ fontSize: "26px", margin: "8px 0 4px", color: "#0f172a" }}>4,812</h3>
                <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>&uarr; 12% this week</span>
              </div>
              <div
                id="metric-journeys"
                data-testid="metric-card-journeys"
                style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>Walkthrough Runs</span>
                <h3 style={{ fontSize: "26px", margin: "8px 0 4px", color: "#0f172a" }}>1,290</h3>
                <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>&uarr; 28% completion</span>
              </div>
              <div
                id="metric-satisfaction"
                data-testid="metric-card-satisfaction"
                style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600 }}>Satisfaction Score</span>
                <h3 style={{ fontSize: "26px", margin: "8px 0 4px", color: "#0f172a" }}>99.2%</h3>
                <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>Verified feedback</span>
              </div>
            </div>

            {/* Dynamic Accordion & Delayed Element Fixture */}
            <div style={{ background: "#ffffff", padding: "24px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px" }}>Dynamic & Delayed DOM Element Fixture</h4>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                    Test how WebJourney handles elements that appear after an asynchronous delay.
                  </p>
                </div>
                <button
                  id="btn-trigger-delayed"
                  data-testid="btn-trigger-delayed"
                  onClick={() => {
                    setTimeout(() => setDelayedButtonVisible(true), 800);
                  }}
                  style={{
                    padding: "8px 14px",
                    background: "#f1f5f9",
                    color: "#334155",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Mount Element (800ms delay)
                </button>
              </div>

              {delayedButtonVisible && (
                <div
                  id="delayed-container"
                  data-testid="delayed-container"
                  style={{ marginTop: "16px", padding: "14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px" }}
                >
                  <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#166534" }}>
                    ✓ Dynamic element successfully mounted into DOM!
                  </p>
                  <button
                    id="btn-delayed-action"
                    data-testid="btn-delayed-action"
                    onClick={() => setDelayedButtonVisible(false)}
                    style={{
                      padding: "6px 12px",
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Confirm Delayed Step
                  </button>
                </div>
              )}
            </div>

            {/* Accordion test */}
            <div style={{ background: "#ffffff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <button
                id="accordion-toggle"
                data-testid="accordion-toggle"
                onClick={() => setAccordionOpen(!accordionOpen)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#0f172a",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between"
                }}
              >
                <span>Collapsible Step Target Section</span>
                <span>{accordionOpen ? "▲ Collapse" : "▼ Expand"}</span>
              </button>
              {accordionOpen && (
                <p id="accordion-content" data-testid="accordion-content" style={{ marginTop: "12px", color: "#475569", fontSize: "13px" }}>
                  This section shifts the page layout dynamically, testing highlight recalculation and resize handlers.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Projects Tab (Field-complete step fixture) */}
        {currentPage === "projects" && (
          <div style={{ background: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Create New Project Workflow</h2>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "4px 0 24px" }}>
              Step Type: <strong>Field Complete</strong> (Verifies input completion without capturing sensitive contents).
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (projectName.trim()) {
                  setProjectCreated(true);
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "450px" }}
            >
              <div>
                <label
                  htmlFor="project-name-input"
                  style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "14px" }}
                >
                  Project Title *
                </label>
                <input
                  id="project-name-input"
                  data-testid="project-name-input"
                  name="projectName"
                  type="text"
                  placeholder="e.g. Q4 Website Relaunch"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="project-desc-input"
                  style={{ display: "block", marginBottom: "6px", fontWeight: 600, fontSize: "14px" }}
                >
                  Project Description
                </label>
                <textarea
                  id="project-desc-input"
                  data-testid="project-desc-input"
                  name="projectDescription"
                  rows={3}
                  placeholder="Briefly describe the goal..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <button
                type="submit"
                id="submit-project-btn"
                data-testid="submit-project-btn"
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  padding: "11px 20px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Create Project
              </button>
            </form>

            {projectCreated && (
              <div
                id="project-success-banner"
                data-testid="project-success-banner"
                style={{
                  marginTop: "24px",
                  padding: "16px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "8px",
                  color: "#065f46"
                }}
              >
                🎉 Project <strong>{projectName}</strong> successfully created!
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {currentPage === "analytics" && (
          <div style={{ background: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Analytics & Reports</h2>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              Navigated here via URL matching <code>#/analytics</code>.
            </p>
            <div style={{ padding: "20px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
              <span id="analytics-chart-placeholder" data-testid="analytics-placeholder" style={{ fontWeight: 600, color: "#475569" }}>
                📊 Multi-Page Navigation Step Target Resolved
              </span>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {currentPage === "settings" && (
          <div style={{ background: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ marginTop: 0, fontSize: "20px" }}>Preferences & Notifications</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input type="checkbox" id="chk-email-notifs" data-testid="settings-checkbox" style={{ width: "18px", height: "18px" }} />
                <span style={{ fontSize: "14px" }}>Enable email notifications for new journeys</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                <input type="checkbox" id="chk-sound" data-testid="settings-checkbox-sound" defaultChecked style={{ width: "18px", height: "18px" }} />
                <span style={{ fontSize: "14px" }}>Play sound on step completion</span>
              </label>
            </div>
          </div>
        )}
      </main>

      {/* Dynamic Modal Dialog Fixture */}
      {isModalOpen && (
        <div
          id="demo-modal-backdrop"
          data-testid="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999
          }}
        >
          <div
            id="demo-modal-dialog"
            data-testid="demo-modal-dialog"
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)"
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "18px" }}>Interactive Modal Target</h3>
            <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: "13px", lineHeight: 1.5 }}>
              This dialog tests overlay positioning on high z-index elements and verifying clicks inside modals.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                id="btn-modal-confirm"
                data-testid="btn-modal-confirm"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px"
                }}
              >
                Confirm Action
              </button>
              <button
                id="btn-modal-close"
                data-testid="btn-modal-close"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "13px"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
