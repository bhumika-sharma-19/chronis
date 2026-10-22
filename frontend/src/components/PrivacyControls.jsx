import { useState } from "react";
import { updatePermission } from "../api";

const CATEGORIES = [
  {
    type: "conversation",
    title: "Conversation",
    description: "Speech transcripts, chat records, and dialogue logs.",
  },
  {
    type: "location",
    title: "Location",
    description: "Geographic locations, check-ins, and travel records.",
  },
  {
    type: "physiological",
    title: "Physiological",
    description: "Biometric readings, heart rate metrics, and workout logs.",
  },
  {
    type: "note",
    title: "Note",
    description: "Personal thoughts, written notes, and quick reflections.",
  },
];

export default function PrivacyControls({ permissions = {}, onPermissionChange }) {
  const [updatingType, setUpdatingType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleToggle(type, currentEnabled) {
    const nextState = !currentEnabled;
    setUpdatingType(type);
    setErrorMessage("");

    try {
      await updatePermission(type, nextState);
      onPermissionChange?.(type, nextState);
    } catch (err) {
      setErrorMessage(err.message || "Failed to update permission.");
    } finally {
      setUpdatingType("");
    }
  }

  return (
    <section className="section-card">
      <div className="section-header">
        <h2 className="section-heading">Privacy Controls</h2>
        <p className="section-description">
          Toggle category permissions. When turned off, the backend stops returning that category&apos;s data across all endpoints.
        </p>
      </div>

      {errorMessage && (
        <div className="banner banner-error">{errorMessage}</div>
      )}

      <div className="privacy-list">
        {CATEGORIES.map((cat) => {
          const isEnabled = permissions[cat.type] !== false;
          const isUpdating = updatingType === cat.type;

          return (
            <div
              key={cat.type}
              className={`privacy-row ${isEnabled ? "" : "row-disabled"}`}
            >
              <div className="privacy-info">
                <div className="privacy-title-line">
                  <h3 className="privacy-name">{cat.title}</h3>
                  <span className={`badge ${isEnabled ? "badge-active" : "badge-disabled"}`}>
                    {isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="privacy-desc">{cat.description}</p>
                {!isEnabled && (
                  <p className="privacy-warning">
                    Data blocked: backend returns 403 Forbidden for this category.
                  </p>
                )}
              </div>

              <div className="privacy-action">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={isUpdating}
                    onChange={() => handleToggle(cat.type, isEnabled)}
                    aria-label={`Toggle ${cat.title} permission`}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
