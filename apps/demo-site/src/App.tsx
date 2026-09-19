import { useState } from "react";

export function App() {
  const [currentPage, setCurrentPage] = useState<"dashboard" | "settings" | "projects">("dashboard");
  const [projectName, setProjectName] = useState("");
  const [projectCreated, setProjectCreated] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
            style={{
              width: "32px",
              height: "32px",
              background: "#3b82f6",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700
            }}
          >
            WJ
          </div>
          <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>Acme Workspace (Demo)</h1>
        </div>

        {/* Multi-page Nav */}
        <nav style={{ display: "flex", gap: "8px" }}>
          <button
            data-testid="nav-dashboard"
            onClick={() => setCurrentPage("dashboard")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "dashboard" ? "#3b82f6" : "transparent",
              color: currentPage === "dashboard" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Dashboard
          </button>
          <button
            data-testid="nav-projects"
            onClick={() => setCurrentPage("projects")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "projects" ? "#3b82f6" : "transparent",
              color: currentPage === "projects" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Projects
          </button>
          <button
            data-testid="nav-settings"
            onClick={() => setCurrentPage("settings")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              background: currentPage === "settings" ? "#3b82f6" : "transparent",
              color: currentPage === "settings" ? "#ffffff" : "#475569",
              fontWeight: 600
            }}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ padding: "32px", maxWidth: "1000px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {currentPage === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "24px" }}>Welcome to your Dashboard</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                  This demo application contains realistic UI targets for testing WebJourney journeys.
                </p>
              </div>
              <button
                data-testid="btn-open-modal"
                id="action-open-modal"
                onClick={() => setIsModalOpen(true)}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                + Quick Action Modal
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
              <div
                data-testid="metric-card-1"
                style={{ background: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "14px" }}>Active Users</span>
                <h3 style={{ fontSize: "28px", margin: "8px 0 0" }}>1,248</h3>
              </div>
              <div
                data-testid="metric-card-2"
                style={{ background: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "14px" }}>Completed Tours</span>
                <h3 style={{ fontSize: "28px", margin: "8px 0 0" }}>582</h3>
              </div>
              <div
                data-testid="metric-card-3"
                style={{ background: "#fff", padding: "20px", borderRadius: "10px", border: "1px solid #e2e8f0" }}
              >
                <span style={{ color: "#64748b", fontSize: "14px" }}>Satisfaction Rate</span>
                <h3 style={{ fontSize: "28px", margin: "8px 0 0" }}>98.4%</h3>
              </div>
            </div>
          </div>
        )}

        {currentPage === "projects" && (
          <div style={{ background: "#fff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ marginTop: 0 }}>Create a New Project</h2>
            <p style={{ color: "#64748b" }}>Test field completion and submission actions.</p>

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
                  Project Name
                </label>
                <input
                  id="project-name-input"
                  data-testid="project-name-input"
                  type="text"
                  placeholder="e.g. Website Revamp 2026"
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

              <button
                type="submit"
                id="submit-project-btn"
                data-testid="submit-project-btn"
                style={{
                  background: "#10b981",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer"
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
                  marginTop: "20px",
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

        {currentPage === "settings" && (
          <div style={{ background: "#fff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ marginTop: 0 }}>System Settings</h2>
            <p style={{ color: "#64748b" }}>Test navigation and toggle interactions.</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input type="checkbox" id="email-notifs" data-testid="settings-checkbox" style={{ width: "18px", height: "18px" }} />
              <label htmlFor="email-notifs" style={{ fontSize: "15px" }}>Enable email notifications</label>
            </div>
          </div>
        )}
      </main>

      {/* Dynamic Modal */}
      {isModalOpen && (
        <div
          id="demo-modal-backdrop"
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
              background: "#fff",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
            }}
          >
            <h3 style={{ margin: "0 0 12px" }}>Quick Action Dialog</h3>
            <p style={{ color: "#64748b", margin: "0 0 20px" }}>
              This tests dynamic elements that mount and unmount into the DOM.
            </p>
            <button
              id="close-modal-btn"
              data-testid="close-modal-btn"
              onClick={() => setIsModalOpen(false)}
              style={{
                background: "#f1f5f9",
                color: "#334155",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              Close Dialog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
