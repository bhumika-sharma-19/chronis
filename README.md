# Chronis: Mini Privacy-Aware Memory Timeline

A privacy-first timeline application that captures daily user events across multiple categories (`conversation`, `location`, `physiological`, `note`), enforces category-level access permissions strictly at the backend query layer, and maintains an immutable, read-only audit log for all data access and permission changes.

---

## 1. System Architecture

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                  Frontend (React + Vite SPA)                    │
   │  • Category Filter Buttons     • Privacy Toggle Switches (ON/OFF)│
   │  • Chronological Memory Cards  • Pagination Controls            │
   │  • Event Deletion & Creation   • Real-Time Audit Log View       │
   └────────────────────────────────┬────────────────────────────────┘
                                    │ HTTP / REST JSON
                                    ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                     Backend API (Flask)                         │
   │  • /events (GET, POST)         • /permissions (GET, PUT)        │
   │  • /events/<id> (GET, DELETE)  • /audit-log (GET, Read-Only)    │
   │                                                                 │
   │           ┌─────────────────────────────────────────┐           │
   │           │   Backend Authorization Guard (Policy)  │           │
   │           │ • Checks active category permission     │           │
   │           │ • Filters SQL query by enabled types    │           │
   │           │ • Emits audit records (success/blocked) │           │
   │           └────────────────────┬────────────────────┘           │
   └────────────────────────────────┼────────────────────────────────┘
                                    ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │                     Database (SQLite / SQL)                     │
   │  • users (id, name)                                             │
   │  • events (id, user_id, timestamp, type, title, content)        │
   │  • permissions (id, user_id, event_type, enabled)               │
   │  • audit_logs (id, timestamp, user_id, action, event_type, res) │
   └─────────────────────────────────────────────────────────────────┘
```

### Core Architecture Highlights
- **Strict Query-Level Authorization:** Category permissions are evaluated prior to database execution. Queries strictly filter `WHERE type IN (enabled_categories)`. Data belonging to a disabled category is **never loaded from disk into memory** for timeline queries.
- **Fail-Closed Security:** If a permission record is missing or falsy, access is denied by default (`403 Forbidden`).
- **Immutable Audit Trail:** Read, create, delete, and permission change attempts are synchronously written to the `audit_logs` table with status `success` or `blocked`.
- **Environment Driven Configuration:** Configurable via environment variables with fallback defaults for local development.

---

## 2. Database Schema

The database utilizes 4 distinct relational tables:

1. **`users`**
   - `id` (INTEGER, Primary Key)
   - `name` (VARCHAR(100), Not Null)

2. **`permissions`**
   - `id` (INTEGER, Primary Key)
   - `user_id` (INTEGER, Foreign Key -> `users.id`)
   - `event_type` (VARCHAR(30), Not Null)
   - `enabled` (BOOLEAN, Default True)
   - *Constraint:* Unique constraint on `(user_id, event_type)`.

3. **`events`**
   - `id` (INTEGER, Primary Key)
   - `user_id` (INTEGER, Foreign Key -> `users.id`)
   - `timestamp` (DATETIME, UTC, Not Null)
   - `type` (VARCHAR(30), Not Null — `conversation`, `location`, `physiological`, `note`)
   - `title` (VARCHAR(200), Not Null)
   - `content` (TEXT, Not Null)

4. **`audit_logs`**
   - `id` (INTEGER, Primary Key)
   - `timestamp` (DATETIME, UTC, Default Current Time)
   - `user_id` (INTEGER, Foreign Key -> `users.id`)
   - `action` (VARCHAR(50), Not Null — `read_events`, `read_event`, `create_event`, `delete_event`, `update_permission`)
   - `event_type` (VARCHAR(30), Nullable)
   - `result` (VARCHAR(30), Not Null — `success`, `blocked`)

---

## 3. Quickstart & Setup Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### A. Backend Setup
1. Open a terminal in the project root and navigate to `backend`:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. (Optional) Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
5. Start the Flask API server:
   ```bash
   python app.py
   ```
   *The server starts on `http://127.0.0.1:5000` and automatically initializes SQLite database tables, the seeded demo user (`id=1`), default permissions, and initial demo events.*

### B. Running Automated Tests
Run pytest from the project root or backend directory:
```bash
# From project root
pytest backend/tests -v
```

### C. Frontend Setup
1. In a new terminal, navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser at `http://localhost:5173`.

---

## 4. API Documentation

Base URL: `http://127.0.0.1:5000`

A ready-to-import Postman collection is also provided at [`chronis_postman_collection.json`](file:///c:/Users/bhumi/chronis/chronis_postman_collection.json).

### Endpoints Overview

| Method | Endpoint | Description | Query / Body Params | Auth / Privacy Guard |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | API Status & Info | None | None |
| `GET` | `/permissions` | Get user category permissions | None | User context |
| `PUT` | `/permissions/<type>` | Toggle permission ON/OFF | Body: `{"enabled": boolean}` | User context, logged to audit |
| `GET` | `/events` | Get timeline events | `type`, `page`, `per_page` | Omits disabled types; `403` if requested type disabled |
| `GET` | `/events/<id>` | Get single event by ID | Path: `id` | `403` if event category disabled |
| `POST` | `/events` | Create new event | Body: `type`, `title`, `content`, `timestamp` (optional) | `403` if category disabled |
| `DELETE` | `/events/<id>` | Delete event by ID | Path: `id` | `403` if category disabled |
| `GET` | `/audit-log` | View immutable audit trail | None | Read-only |

### Detailed Endpoint Specifications

#### 1. `GET /events`
Fetches paginated memories belonging to currently enabled categories.
- **Query Parameters:**
  - `type` *(optional)*: Category filter (`conversation`, `location`, `physiological`, `note`).
  - `page` *(optional, default: 1)*: Current page number (>= 1).
  - `per_page` *(optional, default: 10)*: Records per page (1 to 100).
- **Behavior:**
  - If `type` is omitted: Returns all events where `type IN (enabled_categories)`.
  - If `type` is specified and that category is **disabled**: Returns HTTP `403 Forbidden` and logs a `blocked` audit record.
- **Response `200 OK`:**
  ```json
  {
    "events": [
      {
        "id": 1,
        "user_id": 1,
        "timestamp": "2026-10-22T08:30:00+00:00",
        "type": "conversation",
        "title": "Roadmap planning",
        "content": "Discussed Q4 privacy requirements."
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 10,
      "total": 1,
      "total_pages": 1
    }
  }
  ```

#### 2. `GET /events/<id>`
- **Response `200 OK`:** Returns event JSON if found and category is enabled.
- **Response `403 Forbidden`:** If the event's category has been turned OFF.
  ```json
  { "error": "Access denied: this event category is disabled" }
  ```
- **Response `404 Not Found`:** If event does not exist.

#### 3. `POST /events`
- **Request Body:**
  ```json
  {
    "type": "note",
    "title": "Meeting summary",
    "content": "Decided on backend authorization design.",
    "timestamp": "2026-10-22T10:00:00Z"
  }
  ```
- **Response `201 Created`:** Returns created event.
- **Response `403 Forbidden`:** If user tries to create an event for a category that is currently disabled.

#### 4. `DELETE /events/<id>`
- **Response `200 OK`:**
  ```json
  { "message": "Event deleted successfully", "id": 1 }
  ```
- **Response `403 Forbidden`:** If the event's category is currently turned OFF.
- **Response `404 Not Found`:** If event does not exist.

#### 5. `GET /permissions` & `PUT /permissions/<type>`
- **`GET /permissions`** Returns:
  ```json
  {
    "conversation": true,
    "location": true,
    "physiological": true,
    "note": true
  }
  ```
- **`PUT /permissions/<type>`** Request:
  ```json
  { "enabled": false }
  ```
  Returns `200 OK` with updated status and records an audit log entry.

#### 6. `GET /audit-log`
- Returns chronological list of all data and privacy access attempts (read-only).
- **Response `200 OK`:**
  ```json
  {
    "audit_logs": [
      {
        "id": 1,
        "timestamp": "2026-10-22T09:15:00+00:00",
        "user_id": 1,
        "action": "read_events",
        "event_type": "location",
        "result": "blocked"
      }
    ],
    "total": 1
  }
  ```

---

## 5. Short Engineering Note

### 1. Where is authorization enforced and why?
**Authorization is enforced strictly on the backend at the database query layer.**

*Why:* 
Enforcing permissions in the frontend is purely cosmetic and vulnerable to trivial bypasses via direct API calls (`curl`, Postman, developer tools). In our architecture, the backend handler inspects the user's active permissions stored in the database. When a timeline request arrives without a category filter, the SQL query explicitly restricts the result set using `Event.type.in_(enabled_categories)`. 

If a specific category filter is requested (e.g. `GET /events?type=location`) and that permission is turned `OFF`, the backend intercepts the request, writes a `blocked` entry to `AuditLog`, and immediately responds with `403 Forbidden`. Data from disabled categories is **never retrieved from disk into application memory**, preventing accidental data leaks or in-memory serialization bugs.

### 2. What happens when a user requests data they are not allowed to see?
When a user attempts to read, create, or delete an event belonging to a disabled category:
1. **Request Interception:** The authorization guard determines the category is disabled (`enabled == False`).
2. **Audit Logging:** An audit entry is immediately committed to the `audit_logs` table (`action="read_events"`, `event_type="location"`, `result="blocked"`).
3. **Response Status:** The API returns an HTTP **`403 Forbidden`** with an explicit error message: `{"error": "Access denied: this event category is disabled"}`.
4. **Timeline Filtering Invariant:** In the general timeline view (`GET /events`), no error is thrown; rather, disabled categories are filtered out of the SQL query so that only authorized memories are returned.

*(Note on 403 vs 404: For individual event lookups `GET /events/<id>`, returning `404` could be chosen to prevent leaking whether an ID exists. However, we return `403` to provide transparent feedback to the authenticated user that the record exists under their ownership but cannot be accessed until the privacy permission is re-enabled).*

### 3. What is one weakness that still exists in your implementation?
**The lack of granular cryptographic encryption at rest per category.**

While the relational database enforces access control logically via SQL filters, the underlying data records in `events` remain in plaintext SQLite storage. If the database file is accessed directly (e.g. via direct disk inspection, compromised backup, or privileged database administrator query), the disabled categories could be read. 

*Mitigation:* In a production system, each category should be encrypted with a dedicated per-user/per-category key derived via KMS or user password, such that turning a category OFF temporarily zeroes or locks the decryption key in memory.

### 4. How would you change the system if it grew to 1 million events per user?
At 1 million events per user, SQLite and straightforward offset pagination will encounter performance bottlenecks. The following architectural evolutions would be made:
1. **Database Migration to PostgreSQL with Partitioning:** Migrate to PostgreSQL and partition the `events` table by `(user_id, timestamp)` or `(user_id, type)`.
2. **Compound Indexing:** Add a compound index on `(user_id, type, timestamp DESC)`. This allows index-only scans when filtering by enabled categories.
3. **Keyset / Cursor-Based Pagination:** Replace offset pagination (`OFFSET n`) with cursor-based pagination (`WHERE (timestamp, id) < (cursor_timestamp, cursor_id) LIMIT 20`). `OFFSET 500,000` requires scanning and discarding half a million rows, whereas keyset pagination executes in constant `O(log N)` time.
4. **Caching Permission Bitmaps:** Cache each user's enabled category permissions in an in-memory cache (Redis) with cache invalidation on `PUT /permissions`. This avoids an extra relational query to `permissions` on every timeline request.
5. **Cold Storage Tiering:** Move events older than 6–12 months into partitioned cold storage / Parquet archives with on-demand retrieval.

### 5. What would you improve with one additional day?
With one additional day, I would implement:
1. **Comprehensive JWT Authentication & Multi-Tenancy:** Move beyond the demo user to full multi-tenant auth with OAuth2 / JWT bearer tokens, ensuring users can only manage their own timeline.
2. **Date Range Filtering (`start_date`, `end_date`) and Full-Text Search:** Implement date range bounds and SQLite FTS5 / PostgreSQL Trigram full-text search across titles and contents.
3. **Bulk Permission Toggles & Granular Policies:** Allow time-bound access (e.g., "Mute location tracking for the next 2 hours") and export/redaction tools (GDPR "Right to be Forgotten" export package).
4. **Interactive OpenAPI / Swagger UI:** Mount Swagger UI directly into Flask at `/docs` using Flasgger or FastAPI.

---

## 6. Automated Testing Verification

The test suite covers all requirements outlined in the specification:

```bash
pytest backend/tests -v
```

| Test Function | What It Verifies | Status |
| :--- | :--- | :---: |
| `test_create_and_fetch_event` | Creates event and retrieves it via `GET /events/{id}` | ✅ Passed |
| `test_filter_and_pagination` | Validates category filtering, page limits, total counts, and page slicing | ✅ Passed |
| `test_enabled_and_disabled_category_in_timeline` | Ensures disabled categories are omitted from bulk timeline queries | ✅ Passed |
| `test_get_single_event_blocked_when_disabled` | Proves single event fetch returns `403` when disabled and `200` when enabled | ✅ Passed |
| `test_permission_change_cycle_affects_later_requests` | Dynamic permissions immediately govern subsequent read/write requests | ✅ Passed |
| `test_delete_event_with_privacy_control` | Event deletion works when enabled, blocks when disabled, returns 404 for missing | ✅ Passed |
| `test_audit_log_records_important_actions` | Validates audit records for creations, reads, deletes, updates, and immutability | ✅ Passed |
| `test_validation_and_bad_requests` | Validates 400 bad request handling on invalid types, missing fields, bad pagination | ✅ Passed |

---

## 7. Demo Video Walkthrough Guide (3–5 Minutes)

When recording your demo video, follow this sequence:

1. **Overview (30s):**
   - Introduce Chronis: personal memory timeline with category permissions and audit logging.
   - Point out the active categories: `conversation`, `location`, `physiological`, `note`.
2. **Timeline Demonstration (45s):**
   - Show the timeline displaying memories. Demonstrate category filter buttons (`All`, `Location`, `Notes`).
   - Show pagination controls navigating through pages.
3. **Demonstrating Privacy Enforcement (1m 15s):**
   - Locate the **Privacy Controls** panel.
   - Toggle **Location** to **OFF**.
   - Show that Location events immediately disappear from the timeline.
   - Switch the filter button to "Location" to show that the backend returns `403 Access Denied`.
   - Use `curl` or Postman to query `GET http://127.0.0.1:5000/events?type=location` directly in terminal to prove the **API blocks the data, not just the frontend**.
4. **Audit Log Inspection (45s):**
   - Scroll down to the **Audit Log** section.
   - Show that toggling the permission generated an `update_permission` record.
   - Show that attempting to access location data generated a `blocked` record for `read_events`.
5. **Run the Tests (30s):**
   - Run `pytest backend/tests -v` in the terminal and show that all 8 automated tests pass.
