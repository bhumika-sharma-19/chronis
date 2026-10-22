import { useEffect, useState } from "react";
import { getAuditLog } from "../api";

export default function AuditLog({ refreshKey = 0 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAuditLog() {
    try {
      setLoading(true);
      setError("");

      const data = await getAuditLog();
      setLogs(
        Array.isArray(data) ? data : data.audit_logs ?? data.logs ?? []
      );
    } catch (err) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLog();
  }, [refreshKey]);

  return (
    <section className="audit-section">
      <div className="section-heading audit-header-row">
        <div>
          <h2>Audit Log</h2>
          <p>
            Immutable, read-only record of all memory and privacy actions.
          </p>
        </div>

        <button
          className="refresh-log-button"
          onClick={loadAuditLog}
          disabled={loading}
          type="button"
        >
          {loading ? "Refreshing…" : "↻ Refresh Log"}
        </button>
      </div>

      {loading && <p>Loading audit records…</p>}

      {error && <p className="error-message">{error}</p>}

      {!loading && !error && logs.length === 0 && (
        <p>No audit records found.</p>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="audit-list">
          {logs.map((log, index) => (
            <article
              className="audit-item"
              key={log.id ?? `${log.timestamp}-${index}`}
            >
              <div className="audit-item-header">
                <strong>{log.action}</strong>
                <span className={`audit-status ${log.result}`}>
                  {log.result}
                </span>
              </div>

              <p>Category: {log.event_type || "All / None"}</p>
              <p>User ID: {log.user_id}</p>

              <small>
                {log.timestamp
                  ? new Date(log.timestamp).toLocaleString()
                  : "Time unavailable"}
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
