import { useEffect, useState } from "react";
import { getAuditLog } from "../api";

function formatTimestamp(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

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
        Array.isArray(data)
          ? data
          : data.audit_logs ?? data.logs ?? []
      );
    } catch (err) {
      setError(err.message || "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAuditLog();
  }, [refreshKey]);

  return (
    <section className="section-card">
      <div className="section-header-row">
        <div>
          <h2 className="section-heading">Audit Log</h2>
          <p className="section-description">
            Read-only ledger of data access, permission updates, and authorization outcomes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadAuditLog}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="banner banner-error">{error}</div>}

      <div className="table-wrapper">
        {loading && logs.length === 0 ? (
          <div className="state-message">Loading audit records…</div>
        ) : logs.length === 0 ? (
          <div className="state-message">No audit activity recorded yet.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Result</th>
                <th>Action</th>
                <th>Category</th>
                <th>User ID</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => {
                const isSuccess = log.result === "success";
                return (
                  <tr key={log.id ?? index}>
                    <td>
                      <span className={`result-tag ${isSuccess ? "result-success" : "result-blocked"}`}>
                        {log.result}
                      </span>
                    </td>
                    <td>
                      <code className="code-snippet">{log.action}</code>
                    </td>
                    <td>
                      <span className="category-text">
                        {log.event_type || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className="user-id-text">User {log.user_id}</span>
                    </td>
                    <td className="timestamp-text">
                      {formatTimestamp(log.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
