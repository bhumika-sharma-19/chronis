
import { useEffect, useState } from "react";
import { getPermissions, updatePermission } from "../api";

const categories = [
  {
    type: "conversation",
    title: "Conversations",
    description: "Saved conversation memories",
  },
  {
    type: "location",
    title: "Location",
    description: "Saved location records",
  },
  {
    type: "physiological",
    title: "Physiological",
    description: "Physiological memory records",
  },
  {
    type: "note",
    title: "Notes",
    description: "Personal notes and reminders",
  },
];

export default function PrivacyControls({ onChanged }) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPermissions() {
      try {
        const data = await getPermissions();
        setPermissions(data);
      } catch (err) {
        setError(err.message || "Could not load privacy settings.");
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, []);

  async function handleToggle(type, enabled) {
    const previousValue = permissions[type];

    setError("");
    setMessage("");
    setUpdating(type);

    // Update the UI only after the backend accepts the change.
    try {
      await updatePermission(type, enabled);

      setPermissions((previous) => ({
        ...previous,
        [type]: enabled,
      }));

      setMessage(
        `${categories.find((item) => item.type === type).title} ${enabled ? "enabled" : "disabled"
        }.`
      );

      onChanged?.();
    } catch (err) {
      setError(err.message || "Could not update privacy settings.");

      // Keep the previous setting if the request fails.
      setPermissions((previous) => ({
        ...previous,
        [type]: previousValue,
      }));
    } finally {
      setUpdating("");
    }
  }

  return (
    <section className="privacy-panel">
      <div className="privacy-heading">
        <div className="privacy-icon">♧</div>
        <div>
          <p className="eyebrow">YOUR DATA, YOUR CHOICE</p>
          <h2>Privacy Controls</h2>
          <p className="section-description">
            Choose which memory categories Chronis can access.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="privacy-status">Loading privacy settings…</p>
      ) : (
        <div className="privacy-list">
          {categories.map((category) => {
            const enabled = permissions[category.type] === true;

            return (
              <div className="privacy-row" key={category.type}>
                <div className="privacy-copy">
                  <h3>{category.title}</h3>
                  <p>{category.description}</p>
                  <span
                    className={
                      enabled
                        ? "permission-label enabled"
                        : "permission-label disabled"
                    }
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>

                <label className="toggle-control">
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={updating !== ""}
                    onChange={(event) =>
                      handleToggle(category.type, event.target.checked)
                    }
                    aria-label={`Enable ${category.title} memories`}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {updating && (
        <p className="privacy-status">Updating privacy settings…</p>
      )}

      {error && <p className="form-error">{error}</p>}
      {message && <p className="form-success">{message}</p>}
    </section>
  );
}
