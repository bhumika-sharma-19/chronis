
import { useEffect, useState } from "react";
import { getAuditLog } from "../api";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


useEffect(() => {
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  loadAuditLog();

  const intervalId = setInterval(loadAuditLog, 5000);

  return () => clearInterval(intervalId);
}, []);


  return (
    <section className="audit-section">
      <div className="section-heading">
        <div>
          <h2>Audit Log</h2>
          <p>Track privacy and memory access activity.</p>
        </div>
      </div>

      {loading && <p>Loading audit records...</p>}

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

              <p>
                Category: {log.event_type || "N/A"}
              </p>

              <p>
                User ID: {log.user_id}
              </p>

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
