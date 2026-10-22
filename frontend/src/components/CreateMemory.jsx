import { useState } from "react";
import { createEvent } from "../api";

const CATEGORIES = [
  { value: "note", label: "Note" },
  { value: "conversation", label: "Conversation" },
  { value: "location", label: "Location" },
  { value: "physiological", label: "Physiological" },
];

const initialForm = {
  type: "note",
  title: "",
  content: "",
};

export default function CreateMemory({ onCreated, permissions = {} }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isSelectedDisabled = permissions[form.type] === false;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.content.trim()) {
      setError("Please provide both a title and details.");
      return;
    }

    setSaving(true);

    try {
      await createEvent({
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
      });

      setForm(initialForm);
      setSuccess("Memory saved successfully.");
      onCreated?.();
    } catch (err) {
      setError(err.message || "Failed to create memory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-card">
      <div className="section-header">
        <h2 className="section-heading">Create Memory</h2>
        <p className="section-description">
          Add an event to the timeline. Submissions respect active privacy permissions.
        </p>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {success && <div className="banner banner-success">{success}</div>}
      {isSelectedDisabled && (
        <div className="banner banner-warning">
          <strong>Notice:</strong> The <em>{form.type}</em> category is currently disabled. The backend will return a 403 Forbidden response.
        </div>
      )}

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group form-group-sm">
            <label htmlFor="memory-type" className="label">
              Category
            </label>
            <select
              id="memory-type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="input select"
              disabled={saving}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group form-group-lg">
            <label htmlFor="memory-title" className="label">
              Title
            </label>
            <input
              id="memory-title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Sprint planning meeting"
              maxLength={150}
              required
              className="input"
              disabled={saving}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="memory-content" className="label">
            Details
          </label>
          <textarea
            id="memory-content"
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder="What happened or what would you like to remember?"
            rows={3}
            required
            className="input textarea"
            disabled={saving}
          />
        </div>

        <div className="form-footer">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Memory"}
          </button>
        </div>
      </form>
    </section>
  );
}
