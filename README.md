# Chronis — Privacy-Aware Memory Timeline

Chronis is a small full-stack application that stores a user's daily events, displays them in a chronological timeline, and allows category-level privacy controls. The backend enforces permissions before returning or modifying event data and records important actions in an audit log.

## Features

- Create, retrieve, and delete memory events.
- Filter events by type and paginate results.
- Manage privacy permissions for `conversation`, `location`, `physiological`, and `note`.
- Enforce category permissions on the backend.
- Record important data-access and privacy actions in an audit log.
- Display events, privacy controls, and audit records through a React frontend.
- Run automated backend tests with pytest.

## Technology Stack

- **Backend:** Python, Flask, Flask-SQLAlchemy
- **Database:** SQLite
- **Frontend:** React, Vite
- **Testing:** pytest
- **Cross-origin requests:** Flask-CORS

## Project Structure

```text
chronis/
├── backend/
│   ├── app.py
│   ├── models.py
│   ├── requirements.txt
│   └── tests/
│       └── test_app.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── .gitignore
└── README.md
```

The structure above describes the intended layout. If your actual files differ, update this section to match your repository.

## Prerequisites

- Python 3.10 or later
- Node.js and npm
- Git

## Setup and Running

### 1. Clone the repository

```bash
git clone https://github.com/bhumika-sharma-19/chronis.git
cd chronis
```

### 2. Set up the backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
python app.py
```

The API should be available at `http://127.0.0.1:5000`.

The application creates the database tables and demo user when started, according to its current initialization logic.

### 3. Set up the frontend

Open a second terminal:

```bash
cd chronis/frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Keep both the backend and frontend running while using the application.

## API Documentation

The API uses JSON request and response bodies. The current implementation uses a seeded demo user rather than a full authentication system.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Check that the API is running |
| GET | `/events` | Retrieve events, with optional type filtering and pagination |
| GET | `/events/<id>` | Retrieve a single event |
| POST | `/events` | Create an event |
| DELETE | `/events/<id>` | Delete an event |
| GET | `/permissions` | Retrieve category permission settings |
| PUT | `/permissions/<event_type>` | Enable or disable a category |
| GET | `/audit-log` | Read audit records |

### Event format

An event contains:

- `id`
- `user_id`
- `timestamp`
- `type`
- `title`
- `content`

Supported types are `conversation`, `location`, `physiological`, and `note`.

### Create an event

Example request to `POST /events`:

```json
{
  "type": "note",
  "title": "Daily reflection",
  "content": "Completed my planned tasks."
}
```

The event category must be enabled for the request to succeed.

### Filter and paginate events

Example:

```text
GET /events?type=note&page=1&per_page=10
```

The type parameter filters events. The page and per-page parameters control pagination.

### Change a permission

Example request to `PUT /permissions/location`:

```json
{
  "enabled": false
}
```

When a category is disabled, the backend blocks requests for that category. A request specifically targeting a disabled category returns an error response rather than exposing its data.

### Read the audit log

```text
GET /audit-log
```

This endpoint returns audit records. The API does not provide an endpoint for editing or deleting audit records.

## Privacy and Authorization

Privacy enforcement takes place in the Flask backend, not only in the frontend.

Before returning or modifying an event, the backend checks the relevant category permission. The events listing also excludes disabled categories. A request specifically targeting a disabled category is rejected.

Permission checks are performed against the database, so changing a permission affects subsequent requests. The frontend toggles provide a way to manage permissions, but they are not the security boundary.

The audit log records actions such as event reads, event creation, permission-related access outcomes, and deletion, including their result where implemented.

## Database Design

Chronis uses SQLite with four main tables:

- **users:** demo user information.
- **events:** stored memory events.
- **permissions:** enabled or disabled settings for each user and event category.
- **audit_logs:** records of important actions and their outcomes.

The application uses a simplified demo-user model to focus on the assignment's permission logic.

## Running Tests

From the `backend` directory, activate the virtual environment and run:

```bash
pytest -v
```

The current test suite contains five tests covering:

1. Creating and fetching an event.
2. Event filtering and pagination.
3. Blocking access to a disabled category.
4. Applying permission changes to subsequent requests.
5. Recording audit entries.

The tests have previously passed with five successful results. Run them again against the final committed code before submission.

## Engineering Note

### 1. Where is authorization enforced, and why?

Authorization is enforced in the Flask backend before event data is returned or modified. Frontend-only restrictions can be bypassed by calling the API directly, so the backend must be responsible for enforcing permissions.

### 2. What happens when a user requests data they are not allowed to see?

If the requested category is disabled, the backend rejects the request with an error response and records the blocked action where audit logging is implemented. Disabled categories are not returned in the general events listing.

### 3. What is one weakness that still exists?

The application uses a seeded demo user instead of real authentication and user-specific identity verification. It is intended as a prototype, not a production-ready multi-user privacy system.

### 4. How would the system change if it grew to one million events per user?

I would review query patterns, add suitable database indexes, and use efficient pagination—such as cursor-based pagination for large timelines. I would also evaluate a production database such as PostgreSQL, load-test the API, and ensure that permission checks remain enforced consistently.

### 5. What would you improve with one additional day?

I would expand edge-case and integration tests, improve configuration and error handling, verify the audit trail for every relevant privacy-sensitive action, and add clearer API documentation. I would also perform a final end-to-end review of the frontend and backend together.

## Assumptions and Limitations

- A seeded demo user is used instead of full authentication.
- The prototype uses SQLite for straightforward local setup.
- Permissions are defined per event category.
- Date-range filtering, production deployment, authentication, and advanced analytics are outside the current scope.
- This project is a technical assignment prototype and is not intended to be a production-ready security system.
