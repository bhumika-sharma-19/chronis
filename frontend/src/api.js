
const API_BASE_URL = "http://127.0.0.1:5000";

export async function getEvents(type = "all") {
  const params = new URLSearchParams();

  if (type !== "all") {
    params.set("type", type);
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/events${query ? `?${query}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch events");
  }

  return response.json();
}

export async function createEvent(eventData) {
  const response = await fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to create memory");
  }

  return data;
}

export async function getPermissions() {
  const response = await fetch(`${API_BASE_URL}/permissions`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to load permissions");
  }

  return data.permissions ?? data;
}

export async function updatePermission(type, enabled) {
  const response = await fetch(
    `${API_BASE_URL}/permissions/${type}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to update permission");
  }

  return data;
}


export async function getAuditLog() {
  const response = await fetch(`${API_BASE_URL}/audit-log`);
  const data = await response.json();

  console.log("Audit API status:", response.status);
  console.log("Audit API data:", data);

  if (!response.ok) {
    throw new Error(data.error || "Failed to load audit log");
  }

  return data;
}

