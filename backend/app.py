import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS
from models import db, User, Event, Permission, AuditLog

load_dotenv()

app = Flask(__name__)
CORS(app)

# Database configuration via environment variable with SQLite fallback
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///chronis.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Connect SQLAlchemy to Flask
db.init_app(app)

CATEGORIES = [
    "conversation",
    "location",
    "physiological",
    "note",
]


def init_db(app_instance):
    """Initialize database tables and default demo seed data."""
    with app_instance.app_context():
        db.create_all()

        # Create demo user if it does not exist
        user = db.session.get(User, 1)
        if user is None:
            user = User(id=1, name="Demo User")
            db.session.add(user)
            db.session.commit()

        # Create default permissions for all categories
        for category in CATEGORIES:
            permission = Permission.query.filter_by(
                user_id=user.id,
                event_type=category,
            ).first()

            if permission is None:
                permission = Permission(
                    user_id=user.id,
                    event_type=category,
                    enabled=True,
                )
                db.session.add(permission)

        db.session.commit()

        # Seed sample demo events if the events table is empty
        if Event.query.filter_by(user_id=user.id).count() == 0:
            demo_events = [
                Event(
                    user_id=user.id,
                    timestamp=datetime.now(timezone.utc),
                    type="conversation",
                    title="Coffee Chat with Sarah",
                    content="Discussed Q4 product vision and privacy-first personal timeline concepts.",
                ),
                Event(
                    user_id=user.id,
                    timestamp=datetime.now(timezone.utc),
                    type="location",
                    title="Deep Work at Central Library",
                    content="3-hour focused session completing system architecture diagrams.",
                ),
                Event(
                    user_id=user.id,
                    timestamp=datetime.now(timezone.utc),
                    type="physiological",
                    title="Morning Cardio Session",
                    content="Average heart rate 142 bpm. Completed 5 km outdoor run.",
                ),
                Event(
                    user_id=user.id,
                    timestamp=datetime.now(timezone.utc),
                    type="note",
                    title="Architecture Principle",
                    content="Privacy must be enforced strictly at the database query layer, never solely in UI.",
                ),
            ]
            db.session.add_all(demo_events)
            db.session.commit()


# Home route
@app.route("/", methods=["GET"])
def home():
    return {
        "message": "Chronis API is running!",
        "version": "1.0.0",
        "endpoints": [
            "/events",
            "/events/<id>",
            "/permissions",
            "/permissions/<type>",
            "/audit-log",
        ],
    }


# Get all privacy permissions
@app.route("/permissions", methods=["GET"])
def get_permissions():
    permissions = Permission.query.filter_by(user_id=1).all()

    return {
        permission.event_type: permission.enabled
        for permission in permissions
    }


# Update a privacy permission
@app.route("/permissions/<string:event_type>", methods=["PUT"])
def update_permission(event_type):
    user_id = 1  # Demo user

    if event_type not in CATEGORIES:
        return {"error": "Invalid event category"}, 400

    permission = Permission.query.filter_by(
        user_id=user_id,
        event_type=event_type,
    ).first()

    if permission is None:
        return {"error": "Permission not found"}, 404

    data = request.get_json(silent=True)

    if not data or "enabled" not in data:
        return {"error": "Please provide an enabled value"}, 400

    if not isinstance(data["enabled"], bool):
        return {"error": "enabled must be true or false"}, 400

    permission.enabled = data["enabled"]

    # Record privacy permission update in audit log
    db.session.add(
        AuditLog(
            user_id=user_id,
            action="update_permission",
            event_type=event_type,
            result="success",
        )
    )
    db.session.commit()

    return {
        "event_type": permission.event_type,
        "enabled": permission.enabled,
    }


# Get events with privacy checks, filtering, and pagination
@app.route("/events", methods=["GET"])
def get_events():
    user_id = 1  # Demo user

    # Read query parameters
    event_type = request.args.get("type")
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=10, type=int)

    # Validate pagination
    if page < 1 or per_page < 1 or per_page > 100:
        return {
            "error": "page must be >= 1 and per_page must be between 1 and 100"
        }, 400

    # Validate the requested category if provided
    if event_type and event_type not in CATEGORIES:
        return {"error": "Invalid event category"}, 400

    # Load permissions for this user
    permissions = Permission.query.filter_by(user_id=user_id).all()
    permission_map = {p.event_type: p.enabled for p in permissions}

    # Only explicitly enabled categories are allowed to be fetched
    enabled_categories = [
        category for category in CATEGORIES if permission_map.get(category, False)
    ]

    # Helper to record an audit entry
    def record_audit(action, category, result):
        db.session.add(
            AuditLog(
                user_id=user_id,
                action=action,
                event_type=category,
                result=result,
            )
        )

    # Block access if the requested category filter is explicitly disabled
    if event_type and not permission_map.get(event_type, False):
        record_audit("read_events", event_type, "blocked")
        db.session.commit()
        return {
            "error": "Access denied: this event category is disabled"
        }, 403

    # If no categories are enabled, return an empty set immediately
    if not enabled_categories:
        record_audit("read_events", event_type, "success")
        db.session.commit()
        return {
            "events": [],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": 0,
                "total_pages": 0,
            },
        }, 200

    # Query strictly filters to enabled categories only
    query = Event.query.filter(
        Event.user_id == user_id,
        Event.type.in_(enabled_categories),
    )

    # Apply optional category filter
    if event_type:
        query = query.filter(Event.type == event_type)

    # Count matching events before pagination
    total = query.count()

    # Apply pagination and sorting (newest first)
    events = (
        query.order_by(Event.timestamp.desc(), Event.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    record_audit("read_events", event_type, "success")
    db.session.commit()

    return {
        "events": [
            {
                "id": event.id,
                "user_id": event.user_id,
                "timestamp": event.timestamp.isoformat(),
                "type": event.type,
                "title": event.title,
                "content": event.content,
            }
            for event in events
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page if total > 0 else 0,
        },
    }, 200


# Create a new event
@app.route("/events", methods=["POST"])
def create_event():
    user_id = 1  # Demo user

    data = request.get_json(silent=True)

    if not data:
        return {"error": "A JSON request body is required"}, 400

    required_fields = ["type", "title", "content"]
    missing_fields = [
        field for field in required_fields if not data.get(field)
    ]

    if missing_fields:
        return {
            "error": "Missing required fields",
            "fields": missing_fields,
        }, 400

    event_type = data["type"]

    if event_type not in CATEGORIES:
        return {"error": "Invalid event category"}, 400

    permission = Permission.query.filter_by(
        user_id=user_id,
        event_type=event_type,
    ).first()

    # Fail closed if permission is missing or disabled
    if permission is None or not permission.enabled:
        db.session.add(
            AuditLog(
                user_id=user_id,
                action="create_event",
                event_type=event_type,
                result="blocked",
            )
        )
        db.session.commit()

        return {
            "error": "Access denied: this event category is disabled"
        }, 403

    # Allow custom timestamp or default to now (UTC)
    event_timestamp = datetime.now(timezone.utc)
    if "timestamp" in data and data["timestamp"]:
        try:
            ts_str = str(data["timestamp"]).replace("Z", "+00:00")
            event_timestamp = datetime.fromisoformat(ts_str)
        except (ValueError, TypeError):
            return {
                "error": "Invalid timestamp format. Expected ISO-8601 string."
            }, 400

    event = Event(
        user_id=user_id,
        timestamp=event_timestamp,
        type=event_type,
        title=data["title"].strip(),
        content=data["content"].strip(),
    )

    db.session.add(event)
    db.session.add(
        AuditLog(
            user_id=user_id,
            action="create_event",
            event_type=event_type,
            result="success",
        )
    )
    db.session.commit()

    return {
        "id": event.id,
        "user_id": event.user_id,
        "timestamp": event.timestamp.isoformat(),
        "type": event.type,
        "title": event.title,
        "content": event.content,
    }, 201


# Get one event by ID, respecting privacy permissions
@app.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    user_id = 1  # Demo user

    event = Event.query.filter_by(
        id=event_id,
        user_id=user_id,
    ).first()

    if event is None:
        return {"error": "Event not found"}, 404

    permission = Permission.query.filter_by(
        user_id=user_id,
        event_type=event.type,
    ).first()

    # Deny access if permission is missing or disabled
    if permission is None or not permission.enabled:
        db.session.add(
            AuditLog(
                user_id=user_id,
                action="read_event",
                event_type=event.type,
                result="blocked",
            )
        )
        db.session.commit()

        return {
            "error": "Access denied: this event category is disabled"
        }, 403

    db.session.add(
        AuditLog(
            user_id=user_id,
            action="read_event",
            event_type=event.type,
            result="success",
        )
    )
    db.session.commit()

    return {
        "id": event.id,
        "user_id": event.user_id,
        "timestamp": event.timestamp.isoformat(),
        "type": event.type,
        "title": event.title,
        "content": event.content,
    }, 200


# Delete an event, respecting privacy permissions
@app.route("/events/<int:event_id>", methods=["DELETE"])
def delete_event(event_id):
    user_id = 1  # Demo user

    event = Event.query.filter_by(
        id=event_id,
        user_id=user_id,
    ).first()

    if event is None:
        return {"error": "Event not found"}, 404

    permission = Permission.query.filter_by(
        user_id=user_id,
        event_type=event.type,
    ).first()

    # Deny deletion if the category is disabled
    if permission is None or not permission.enabled:
        db.session.add(
            AuditLog(
                user_id=user_id,
                action="delete_event",
                event_type=event.type,
                result="blocked",
            )
        )
        db.session.commit()

        return {
            "error": "Access denied: this event category is disabled"
        }, 403

    event_type = event.type

    db.session.add(
        AuditLog(
            user_id=user_id,
            action="delete_event",
            event_type=event_type,
            result="success",
        )
    )

    db.session.delete(event)
    db.session.commit()

    return {
        "message": "Event deleted successfully",
        "id": event_id,
    }, 200


# View the audit log (read-only)
@app.route("/audit-log", methods=["GET"])
def get_audit_log():
    user_id = 1  # Demo user

    logs = (
        AuditLog.query
        .filter_by(user_id=user_id)
        .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        .all()
    )

    return {
        "audit_logs": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "user_id": log.user_id,
                "action": log.action,
                "event_type": log.event_type,
                "result": log.result,
            }
            for log in logs
        ],
        "total": len(logs),
    }, 200


# Create database tables and demo data, then start server
if __name__ == "__main__":
    init_db(app)
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

