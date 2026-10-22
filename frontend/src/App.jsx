
import { useState } from "react";
import MemoryTimeline from "./components/MemoryTimeline";
import CreateMemory from "./components/CreateMemory";
import PrivacyControls from "./components/PrivacyControls";
import AuditLog from "./components/AuditLog";
import "./App.css";

export default function App() {
  const [timelineRefresh, setTimelineRefresh] = useState(0);

  function refreshTimeline() {
    setTimelineRefresh((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">◈</div>
          <div>
            <h1>Chronis</h1>
            <p>Your personal memory timeline</p>
          </div>
        </div>

        <span className="status-label">
          Privacy-aware memory
        </span>
      </header>

      <PrivacyControls onChanged={refreshTimeline} />

      <CreateMemory onCreated={refreshTimeline} />

      <MemoryTimeline key={timelineRefresh} />

      <AuditLog />
    </main>
  );
}
