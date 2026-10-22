import os
import sys
import pytest

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

from app import app, db
from models import User, Event, Permission, AuditLog


@pytest.fixture
def client(tmp_path):
    """Fixture that configures an isolated in-memory or temporary SQLite test database."""
    test_db_path = tmp_path / "chronis_test.db"

    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{test_db_path.as_posix()}",
    )

    with app.app_context():
        db.session.remove()
        db.engines[None].dispose()
        db.drop_all()
        db.create_all()

        # Seed demo user
        user = User(id=1, name="Test User")
        db.session.add(user)
        db.session.flush()

        # Enable all 4 categories initially
        categories = ["conversation", "location", "physiological", "note"]
        for category in categories:
            db.session.add(
                Permission(
                    user_id=1,
                    event_type=category,
                    enabled=True,
                )
            )

        db.session.commit()

        with app.test_client() as test_client:
            yield test_client

        db.session.remove()
        db.drop_all()
        db.engines[None].dispose()


def test_create_and_fetch_event(client):
    """Verify an event can be created via POST and retrieved via GET /events/{id}."""
    create_res = client.post(
        "/events",
        json={
            "type": "note",
            "title": "Design meeting notes",
            "content": "Discussed privacy boundaries and audit logging schema.",
        },
    )

    assert create_res.status_code == 201
    created_data = create_res.get_json()
    event_id = created_data["id"]

    assert created_data["type"] == "note"
    assert created_data["title"] == "Design meeting notes"
    assert created_data["content"] == "Discussed privacy boundaries and audit logging schema."
    assert "timestamp" in created_data
    assert created_data["user_id"] == 1

    # Fetch event by ID
    fetch_res = client.get(f"/events/{event_id}")
    assert fetch_res.status_code == 200
    fetched_data = fetch_res.get_json()
    assert fetched_data["id"] == event_id
    assert fetched_data["title"] == "Design meeting notes"


def test_filter_and_pagination(client):
    """Verify category filtering and pagination parameters work properly."""
    # Seed 3 notes and 2 conversations
    for i in range(3):
        client.post(
            "/events",
            json={
                "type": "note",
                "title": f"Note {i}",
                "content": f"Note body {i}",
            },
        )

    for i in range(2):
        client.post(
            "/events",
            json={
                "type": "conversation",
                "title": f"Conversation {i}",
                "content": f"Conversation body {i}",
            },
        )

    # Test filtering by category with pagination
    res = client.get("/events?type=note&page=1&per_page=2")
    assert res.status_code == 200
    data = res.get_json()

    assert len(data["events"]) == 2
    assert data["pagination"]["total"] == 3
    assert data["pagination"]["page"] == 1
    assert data["pagination"]["per_page"] == 2
    assert data["pagination"]["total_pages"] == 2
    assert all(e["type"] == "note" for e in data["events"])

    # Test fetching page 2
    page2_res = client.get("/events?type=note&page=2&per_page=2")
    assert page2_res.status_code == 200
    page2_data = page2_res.get_json()
    assert len(page2_data["events"]) == 1


def test_enabled_and_disabled_category_in_timeline(client):
    """Verify disabled categories are excluded from GET /events, while enabled ones are returned."""
    # Create one note and one location event
    client.post(
        "/events",
        json={
            "type": "note",
            "title": "Visible note",
            "content": "Should appear in timeline",
        },
    )
    client.post(
        "/events",
        json={
            "type": "location",
            "title": "Confidential location",
            "content": "Secret location data",
        },
    )

    # Turn off location category
    perm_res = client.put("/permissions/location", json={"enabled": False})
    assert perm_res.status_code == 200

    # Fetch all events (timeline query)
    res = client.get("/events")
    assert res.status_code == 200
    events = res.get_json()["events"]

    # Only note should be returned; location must NOT be returned by the backend
    assert len(events) == 1
    assert events[0]["type"] == "note"
    assert not any(e["type"] == "location" for e in events)

    # Querying the disabled category directly must yield 403 Forbidden
    direct_res = client.get("/events?type=location")
    assert direct_res.status_code == 403
    assert "disabled" in direct_res.get_json()["error"]


def test_get_single_event_blocked_when_disabled(client):
    """Verify GET /events/{id} returns 403 when the event's category is disabled."""
    create_res = client.post(
        "/events",
        json={
            "type": "physiological",
            "title": "Heart rate record",
            "content": "Peak heart rate 155 bpm",
        },
    )
    assert create_res.status_code == 201
    event_id = create_res.get_json()["id"]

    # Verify accessible when enabled
    assert client.get(f"/events/{event_id}").status_code == 200

    # Disable physiological category
    client.put("/permissions/physiological", json={"enabled": False})

    # Verify blocked at backend API layer with 403 Forbidden
    blocked_res = client.get(f"/events/{event_id}")
    assert blocked_res.status_code == 403
    assert "disabled" in blocked_res.get_json()["error"]

    # Re-enable physiological category
    client.put("/permissions/physiological", json={"enabled": True})

    # Verify access is restored
    restored_res = client.get(f"/events/{event_id}")
    assert restored_res.status_code == 200
    assert restored_res.get_json()["id"] == event_id


def test_permission_change_cycle_affects_later_requests(client):
    """Verify changing a permission dynamically governs subsequent create and read operations."""
    # Disable conversation
    client.put("/permissions/conversation", json={"enabled": False})

    # Creation should be blocked
    create_blocked = client.post(
        "/events",
        json={
            "type": "conversation",
            "title": "Blocked conversation",
            "content": "This cannot be saved while disabled",
        },
    )
    assert create_blocked.status_code == 403

    # Enable conversation again
    client.put("/permissions/conversation", json={"enabled": True})

    # Creation should now succeed
    create_allowed = client.post(
        "/events",
        json={
            "type": "conversation",
            "title": "Allowed conversation",
            "content": "This can now be saved",
        },
    )
    assert create_allowed.status_code == 201


def test_delete_event_with_privacy_control(client):
    """Verify DELETE /events/{id} succeeds when enabled and is blocked when category is disabled."""
    # Create an event
    create_res = client.post(
        "/events",
        json={
            "type": "note",
            "title": "Note to delete",
            "content": "Will be deleted",
        },
    )
    event_id = create_res.get_json()["id"]

    # Delete non-existent event -> 404
    assert client.delete("/events/9999").status_code == 404

    # Successfully delete the event
    del_res = client.delete(f"/events/{event_id}")
    assert del_res.status_code == 200
    assert del_res.get_json()["message"] == "Event deleted successfully"

    # Verify event no longer exists
    assert client.get(f"/events/{event_id}").status_code == 404

    # Test deleting an event when category is disabled
    create_loc = client.post(
        "/events",
        json={
            "type": "location",
            "title": "Location to delete",
            "content": "GPS coordinates",
        },
    )
    loc_id = create_loc.get_json()["id"]

    # Disable location
    client.put("/permissions/location", json={"enabled": False})

    # Attempt delete -> 403 Forbidden
    del_blocked = client.delete(f"/events/{loc_id}")
    assert del_blocked.status_code == 403


def test_audit_log_records_important_actions(client):
    """Verify audit log captures events, permission changes, and blocked access attempts."""
    # 1. Create event
    client.post(
        "/events",
        json={
            "type": "note",
            "title": "Audit note",
            "content": "Test content",
        },
    )

    # 2. Update permission
    client.put("/permissions/note", json={"enabled": False})

    # 3. Trigger blocked read
    client.get("/events?type=note")

    # Fetch audit log
    audit_res = client.get("/audit-log")
    assert audit_res.status_code == 200
    logs = audit_res.get_json()["audit_logs"]

    actions = [log["action"] for log in logs]
    results = [log["result"] for log in logs]

    assert "create_event" in actions
    assert "update_permission" in actions
    assert "read_events" in actions
    assert "success" in results
    assert "blocked" in results

    # Verify audit log is read-only (disallow POST/PUT/DELETE)
    assert client.post("/audit-log").status_code == 405
    assert client.delete("/audit-log").status_code == 405


def test_validation_and_bad_requests(client):
    """Verify input validation and error responses for malformed requests."""
    # Missing required fields
    bad_post = client.post("/events", json={"type": "note"})
    assert bad_post.status_code == 400
    assert "Missing required fields" in bad_post.get_json()["error"]

    # Invalid event category
    invalid_cat = client.post(
        "/events",
        json={
            "type": "telepathy",
            "title": "Invalid category",
            "content": "Should fail",
        },
    )
    assert invalid_cat.status_code == 400
    assert "Invalid event category" in invalid_cat.get_json()["error"]

    # Invalid pagination
    bad_page = client.get("/events?page=0")
    assert bad_page.status_code == 400

    bad_per_page = client.get("/events?per_page=200")
    assert bad_per_page.status_code == 400
