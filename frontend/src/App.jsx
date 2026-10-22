import { useEffect, useState } from "react";
import MemoryTimeline from "./components/MemoryTimeline";
import CreateMemory from "./components/CreateMemory";
import PrivacyControls from "./components/PrivacyControls";
import AuditLog from "./components/AuditLog";
import { getPermissions } from "./api";
import "./App.css";

const CATEGORIES = ["conversation", "location", "physiological", "note"];

export default function App() {
  const [permissions, setPermissions] = useState({
    conversation: true,
    location: true,
    physiological: true,
    note: true,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [totalMemories, setTotalMemories] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPerms() {
      try {
        const data = await getPermissions();
        if (!cancelled && data && typeof data === "object") {
          setPermissions(data);
        }
      } catch {
        // Keep current state on network disconnect
      }
    }

    loadPerms();

    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  function triggerRefresh() {
    setRefreshTrigger((v) => v + 1);
  }

  function handlePermissionChange(type, enabled) {
    setPermissions((prev) => ({
      ...prev,
      [type]: enabled,
    }));
    triggerRefresh();
  }

  const enabledCount = CATEGORIES.filter((c) => permissions[c] !== false).length;
  const disabledCount = 4 - enabledCount;

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <div className="brand-icon-box">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="brand-titles">
              <span className="brand-title">Chronis</span>
              <span className="brand-subtitle">Privacy Memory Engine</span>
            </div>
          </div>

          <nav className="navbar-links" aria-label="Main Navigation">
            <a href="#privacy-controls" className="nav-link">Privacy</a>
            <a href="#create-memory" className="nav-link">New Memory</a>
            <a href="#memory-timeline" className="nav-link">Timeline</a>
            <a href="#audit-log" className="nav-link">Audit Trail</a>
          </nav>

          <div className="navbar-status">
            <div className={`status-pill ${disabledCount > 0 ? "status-pill-restricted" : "status-pill-active"}`}>
              <span className="status-dot" />
              <span className="status-text">
                {disabledCount > 0 ? `${disabledCount} Restricted` : "All Categories Active"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Header Hero */}
        <section className="page-header">
          <h1 className="page-title">Personal Memory Timeline</h1>
          <p className="page-subtitle">
            Collect, query, and enforce granular authorization controls across your activity data.
          </p>
        </section>

        {/* 3 Metric Cards */}
        <section className="stats-row" aria-label="Timeline Statistics">
          <div className="stat-card">
            <span className="stat-label">Total Memories</span>
            <div className="stat-value-row">
              <span className="stat-value">{totalMemories}</span>
            </div>
            <span className="stat-hint">Stored in database</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Active Categories</span>
            <div className="stat-value-row">
              <span className="stat-value">{enabledCount}</span>
              <span className="stat-denom">/ 4</span>
            </div>
            <span className="stat-hint">Visible in timeline & queries</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Restricted Categories</span>
            <div className="stat-value-row">
              <span className="stat-value">{disabledCount}</span>
              <span className="stat-denom">/ 4</span>
            </div>
            <span className="stat-hint">
              {disabledCount > 0 ? "Blocked by backend authorization" : "No restrictions applied"}
            </span>
          </div>
        </section>

        {/* Privacy Controls Section */}
        <div id="privacy-controls">
          <PrivacyControls
            permissions={permissions}
            onPermissionChange={handlePermissionChange}
          />
        </div>

        {/* Create Memory Section */}
        <div id="create-memory">
          <CreateMemory
            permissions={permissions}
            onCreated={triggerRefresh}
          />
        </div>

        {/* Timeline Section */}
        <div id="memory-timeline">
          <MemoryTimeline
            refreshKey={refreshTrigger}
            permissions={permissions}
            onEventDeleted={triggerRefresh}
            onTotalEventsChange={setTotalMemories}
          />
        </div>

        {/* Audit Log Section */}
        <div id="audit-log">
          <AuditLog refreshKey={refreshTrigger} />
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <span>Chronis — Privacy-Aware Memory Timeline</span>
          <span className="footer-sub">Backend fail-closed authorization</span>
        </div>
      </footer>
    </div>
  );
}
