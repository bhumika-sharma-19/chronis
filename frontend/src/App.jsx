import { useState } from "react";
import MemoryTimeline from "./components/MemoryTimeline";
import CreateMemory from "./components/CreateMemory";
import PrivacyControls from "./components/PrivacyControls";
import AuditLog from "./components/AuditLog";
import "./App.css";

export default function App() {
  const [refreshCount, setRefreshCount] = useState(0);

  function handleDataChange() {
    setRefreshCount((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">◈</div>
          <div>
            <h1>Chronis</h1>
            <p>Privacy-aware memory timeline</p>
          </div>
        </div>

        <span className="status-label">
          Privacy-Aware Storage
        </span>
      </header>

      <PrivacyControls onChanged={handleDataChange} />

      <CreateMemory onCreated={handleDataChange} />

      <MemoryTimeline
        refreshKey={refreshCount}
        onEventDeleted={handleDataChange}
      />

      <AuditLog refreshKey={refreshCount} />
    </main>
  );
}
