
import { useState } from "react";
import { createEvent } from "../api";

const initialForm = {
  type: "note",
  title: "",
  content: "",
};

export default function CreateMemory({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await createEvent(form);

      setForm(initialForm);
      setSuccess("Memory saved successfully.");
      onCreated?.();
    } catch (err) {
      setError(err.message || "Unable to save memory.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="create-memory-panel">
      <div className="create-memory-heading">
        <div>
          <p className="eyebrow">SAVE SOMETHING IMPORTANT</p>
          <h2>Create Memory</h2>
          <p className="section-description">
            Add a memory to your personal timeline.
          </p>
        </div>
      </div>

      <form className="memory-form" onSubmit={handleSubmit}>
        <label htmlFor="memory-type">Category</label>
        <select
          id="memory-type"
          name="type"
          value={form.type}
          onChange={handleChange}
        >
          <option value="conversation">Conversation</option>
          <option value="location">Location</option>
          <option value="physiological">Physiological</option>
          <option value="note">Note</option>
        </select>

        <label htmlFor="memory-title">Title</label>
        <input
          id="memory-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="e.g. Project discussion"
          maxLength={150}
          required
        />

        <label htmlFor="memory-content">Memory details</label>
        <textarea
          id="memory-content"
          name="content"
          value={form.content}
          onChange={handleChange}
          placeholder="What would you like to remember?"
          rows={4}
          required
        />

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <button className="save-memory-button" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save Memory"}
        </button>
      </form>
    </section>
  );
}
