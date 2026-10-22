
import { useEffect, useState } from "react";
import { getEvents } from "../api";

const categories = [
  "all",
  "conversation",
  "location",
  "physiological",
  "note",
];

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function MemoryTimeline() {
  const [selectedType, setSelectedType] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError("");

      try {
        const data = await getEvents(selectedType);

        if (!cancelled) {
          setEvents(data.events ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(err.message || "Unable to load memories.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, [selectedType, refreshKey]);

  return (
    <section className="timeline-panel">
      <div className="timeline-heading">
        <div>
          <p className="eyebrow">YOUR MEMORY SPACE</p>
          <h2>Memory Timeline</h2>
          <p className="section-description">
            Explore your saved memories in one place.
          </p>
        </div>

        <span className="event-count">
          {loading ? "Loading…" : `${events.length} events`}
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
            onClick={() => setSelectedType(category)}
          >
            {category === "all"
              ? "All memories"
              : category.charAt(0).toUpperCase() +
              category.slice(1)}
          </button>
        ))}
      </div>

      <div className="timeline-list">
        {loading ? (
          <div className="empty-state">
            <h3>Loading memories…</h3>
            <p>Fetching events from Chronis.</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Could not load memories</h3>
            <p>{error}</p>
            <button
              className="filter-button"
              onClick={() => setRefreshKey((key) => key + 1)}
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◇</span>
            <h3>No memories found</h3>
            <p>
              No saved events are available in this category yet.
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
                </div>

                <h3>{event.title}</h3>
                <p>{event.content}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
