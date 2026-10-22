import { useEffect, useState } from "react";
import { getEvents, deleteEvent } from "../api";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "conversation", label: "Conversation" },
  { id: "location", label: "Location" },
  { id: "physiological", label: "Physiological" },
  { id: "note", label: "Note" },
];

function formatDate(timestamp) {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return d.toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return timestamp;
  }
}

export default function MemoryTimeline({
  refreshKey = 0,
  onEventDeleted,
  onTotalEventsChange,
  permissions = {},
}) {
  const [selectedType, setSelectedType] = useState("all");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 8,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const perPage = 8;

  function handleFilterClick(category) {
    setSelectedType(category);
    setPage(1);
    setNotice("");
  }

  async function handleDelete(eventId, title) {
    if (!window.confirm(`Delete "${title || "this memory"}"?`)) {
      return;
    }

    setDeletingId(eventId);
    setError("");
    setNotice("");

    try {
      await deleteEvent(eventId);
      setNotice("Event deleted successfully.");
      onEventDeleted?.();

      if (events.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadEvents();
      }
    } catch (err) {
      setError(err.message || "Failed to delete event.");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadEvents() {
    setLoading(true);
    setError("");

    try {
      const data = await getEvents(selectedType, page, perPage);
      const list = data.events ?? [];
      const pag = data.pagination ?? {
        page: 1,
        per_page: perPage,
        total: list.length,
        total_pages: 1,
      };

      setEvents(list);
      setPagination(pag);

      if (selectedType === "all") {
        onTotalEventsChange?.(pag.total);
      }
    } catch (err) {
      setEvents([]);
      setError(err.message || "Unable to load memories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, [selectedType, page, refreshKey]);

  const isSelectedDisabled =
    selectedType !== "all" && permissions[selectedType] === false;

  return (
    <section className="section-card">
      <div className="section-header-row">
        <div>
          <h2 className="section-heading">Memory Timeline</h2>
          <p className="section-description">
            Chronological log of stored memories.
          </p>
        </div>

        <span className="event-count-badge">
          {pagination.total} {pagination.total === 1 ? "event" : "events"}
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="filter-group">
        {CATEGORIES.map((cat) => {
          const isActive = selectedType === cat.id;
          const isDisabled = cat.id !== "all" && permissions[cat.id] === false;

          return (
            <button
              key={cat.id}
              type="button"
              className={`filter-btn ${isActive ? "active" : ""} ${isDisabled ? "filter-disabled" : ""}`}
              onClick={() => handleFilterClick(cat.id)}
            >
              {cat.label}
              {isDisabled && <span className="disabled-indicator" title="Category disabled" />}
            </button>
          );
        })}
      </div>

      {notice && <div className="banner banner-success">{notice}</div>}
      {isSelectedDisabled && (
        <div className="banner banner-warning">
          <strong>Notice:</strong> The <em>{selectedType}</em> category is turned off. Direct queries are rejected by the backend.
        </div>
      )}

      {/* Events List */}
      <div className="timeline-content">
        {loading ? (
          <div className="state-message">Loading memories…</div>
        ) : error ? (
          <div className="state-message error">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={loadEvents} type="button">
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="state-message">
            <p>No memories available in this view.</p>
          </div>
        ) : (
          <div className="event-list">
            {events.map((event) => (
              <article className="event-card" key={event.id}>
                <div className="event-header">
                  <div className="event-meta">
                    <span className="event-category-tag">{event.type}</span>
                    <time className="event-timestamp">{formatDate(event.timestamp)}</time>
                  </div>

                  <button
                    type="button"
                    className="btn-link-delete"
                    disabled={deletingId === event.id}
                    onClick={() => handleDelete(event.id, event.title)}
                  >
                    {deletingId === event.id ? "Deleting…" : "Delete"}
                  </button>
                </div>

                <h3 className="event-title">{event.title}</h3>
                <p className="event-body">{event.content}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            Page {pagination.page} of {pagination.total_pages}
          </span>

          <div className="pagination-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={page >= pagination.total_pages || loading}
              onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
