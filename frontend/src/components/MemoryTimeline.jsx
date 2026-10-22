import { useEffect, useState } from "react";
import { getEvents, deleteEvent } from "../api";

const categories = [
  "all",
  "conversation",
  "location",
  "physiological",
  "note",
];

function formatDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return timestamp;
  }
}

export default function MemoryTimeline({ refreshKey = 0, onEventDeleted }) {
  const [selectedType, setSelectedType] = useState("all");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 6,
    total: 0,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const perPage = 6;

  function handleFilterChange(category) {
    setSelectedType(category);
    setPage(1); // Reset to first page on category change
  }

  async function handleDelete(eventId) {
    if (!window.confirm("Are you sure you want to delete this memory?")) {
      return;
    }

    setDeletingId(eventId);
    setActionMessage("");
    setError("");

    try {
      await deleteEvent(eventId);
      setActionMessage("Memory deleted successfully.");

      // Refresh data
      onEventDeleted?.();

      // If this was the only item on the current page and page > 1, go back one page
      if (events.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        loadEvents();
      }
    } catch (err) {
      setError(err.message || "Failed to delete memory.");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadEvents() {
    setLoading(true);
    setError("");

    try {
      const data = await getEvents(selectedType, page, perPage);
      setEvents(data.events ?? []);
      setPagination(
        data.pagination ?? {
          page: 1,
          per_page: perPage,
          total: data.events?.length ?? 0,
          total_pages: 1,
        }
      );
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

  return (
    <section className="timeline-panel">
      <div className="timeline-heading">
        <div>
          <p className="eyebrow">YOUR MEMORY SPACE</p>
          <h2>Memory Timeline</h2>
          <p className="section-description">
            Explore and control your saved memories chronologically.
          </p>
        </div>

        <span className="event-count">
          {loading
            ? "Loading…"
            : `${pagination.total ?? events.length} memories`}
        </span>
      </div>

      <div className="timeline-filters">
        {categories.map((category) => (
          <button
            key={category}
            className={
              selectedType === category
                ? "filter-button active"
                : "filter-button"
            }
            onClick={() => handleFilterChange(category)}
          >
            {category === "all"
              ? "All memories"
              : category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {actionMessage && <p className="form-success">{actionMessage}</p>}

      <div className="timeline-list">
        {loading ? (
          <div className="empty-state">
            <h3>Loading memories…</h3>
            <p>Fetching events from Chronis backend.</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Access Denied or Error</h3>
            <p>{error}</p>
            <button className="filter-button" onClick={loadEvents}>
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◇</span>
            <h3>No memories found</h3>
            <p>
              No saved events are available in this category. (They may be
              disabled in Privacy Controls or not created yet).
            </p>
          </div>
        ) : (
          events.map((event) => (
            <article className="memory-card" key={event.id}>
              <div className="timeline-marker" />

              <div className="memory-content">
                <div className="memory-meta">
                  <span className={`category-tag ${event.type}`}>
                    {event.type}
                  </span>
                  <time>{formatDate(event.timestamp)}</time>

                  <button
                    className="delete-event-button"
                    disabled={deletingId === event.id}
                    onClick={() => handleDelete(event.id)}
                    title="Delete this event"
                  >
                    {deletingId === event.id ? "Deleting…" : "✕ Delete"}
                  </button>
                </div>

                <h3>{event.title}</h3>
                <p>{event.content}</p>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.total_pages > 1 && (
        <div className="timeline-pagination">
          <span className="pagination-info">
            Page {pagination.page} of {pagination.total_pages} (
            {pagination.total} events)
          </span>

          <div className="pagination-controls">
            <button
              className="page-nav-button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <button
              className="page-nav-button"
              disabled={page >= pagination.total_pages || loading}
              onClick={() =>
                setPage((p) => Math.min(pagination.total_pages, p + 1))
              }
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
