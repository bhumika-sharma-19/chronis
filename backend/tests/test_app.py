
import pytest
import os
import sys

sys.path.insert(
    0,
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
)

from app import app, db
from models import User, Event, Permission, AuditLog


@pytest.fixture
def client(tmp_path):
    # Create a separate temporary database for each test.
    test_db_path = tmp_path / "chronis_test.db"

    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{test_db_path.as_posix()}",
    )

    # The database engine must be accessed inside app context.
    with app.app_context():
        # Remove any existing session before switching databases.
        db.session.remove()

        # Dispose the previously initialized engine.
        db.engines[None].dispose()

        # Clear the existing tables in the test database only.
        db.drop_all()
        db.create_all()

        # Create a test user.
        user = User(id=1, name="Test User")
        db.session.add(user)
        db.session.flush()

        # Enable all event categories initially.
        categories = [
            "conversation",
            "location",
            "physiological",
            "note",
        ]

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
    response = client.post(
        "/events",
        json={
            "type": "note",
            "title": "Test note",
            "content": "Testing event creation",
        },
    )

    assert response.status_code == 201
    event_id = response.get_json()["id"]

    response = client.get(f"/events/{event_id}")

    assert response.status_code == 200
    assert response.get_json()["title"] == "Test note"


def test_filter_and_pagination(client):
    for i in range(3):
        response = client.post(
            "/events",
            json={
                "type": "note",
                "title": f"Note {i}",
                "content": f"Content {i}",
            },
        )
        assert response.status_code == 201

    response = client.get("/events?type=note&page=1&per_page=2")

    assert response.status_code == 200
    data = response.get_json()
    assert len(data["events"]) == 2
    assert data["pagination"]["total"] == 3
    assert data["pagination"]["page"] == 1


def test_disabled_category_is_blocked(client):
    response = client.put(
        "/permissions/location",
        json={"enabled": False},
    )
    assert response.status_code == 200

    response = client.post(
        "/events",
        json={
            "type": "location",
            "title": "Test location",
            "content": "This should be blocked",
        },
    )
    assert response.status_code == 403

    response = client.get("/events?type=location")
    assert response.status_code == 403


def test_permission_change_affects_later_requests(client):
    response = client.put(
        "/permissions/location",
        json={"enabled": False},
    )
    assert response.status_code == 200

    response = client.get("/permissions")
    assert response.status_code == 200
    assert response.get_json()["location"] is False

    response = client.put(
        "/permissions/location",
        json={"enabled": True},
    )
    assert response.status_code == 200

    response = client.get("/permissions")
    assert response.get_json()["location"] is True


def test_audit_log_records_actions(client):
    client.post(
        "/events",
        json={
            "type": "note",
            "title": "Audit test",
            "content": "Check audit log",
        },
    )

    client.put(
        "/permissions/note",
        json={"enabled": False},
    )

    response = client.get("/audit-log")

    assert response.status_code == 200
    data = response.get_json()
    logs = data["audit_logs"]

    assert len(logs) > 0
    actions = [log["action"] for log in logs]
    assert "create_event" in actions
    assert "update_permission" in actions
    perm_entry = next(log for log in logs if log["action"] == "update_permission")
    assert perm_entry["event_type"] == "note"
    assert perm_entry["result"] == "success"
    assert perm_entry["user_id"] == 1


def test_privacy_enforcement_location_lifecycle(client):
    # 1. Enables the location permission.
    enable_res = client.put(
        "/permissions/location",
        json={"enabled": True},
    )
    assert enable_res.status_code == 200

    # Create an enabled event (note) to verify enabled categories remain accessible
    note_res = client.post(
        "/events",
        json={
            "type": "note",
            "title": "Visible note",
            "content": "This note should stay accessible.",
        },
    )
    assert note_res.status_code == 201
    note_id = note_res.get_json()["id"]

    # 2. Creates a location event successfully.
    loc_res = client.post(
        "/events",
        json={
            "type": "location",
            "title": "Central Park",
            "content": "Checked in at Central Park",
        },
    )
    assert loc_res.status_code == 201
    loc_id = loc_res.get_json()["id"]

    # Confirm it is accessible when enabled
    assert client.get(f"/events/{loc_id}").status_code == 200

    # 3. Disables the location permission.
    disable_res = client.put(
        "/permissions/location",
        json={"enabled": False},
    )
    assert disable_res.status_code == 200

    # 4. Requests GET /events without a type filter.
    timeline_res = client.get("/events")
    assert timeline_res.status_code == 200
    timeline_events = timeline_res.get_json()["events"]

    # 5. Confirms that the location event is not present in the returned data,
    # and that the enabled note event remains present.
    assert not any(e["id"] == loc_id for e in timeline_events)
    assert not any(e["type"] == "location" for e in timeline_events)
    assert any(e["id"] == note_id for e in timeline_events)

    # 6. Confirms that a direct request for that event is rejected according to
    # the application's existing privacy behavior.
    direct_res = client.get(f"/events/{loc_id}")
    assert direct_res.status_code == 403
    assert "disabled" in direct_res.get_json()["error"]

    # Verify that creating a location event while disabled is blocked
    blocked_create = client.post(
        "/events",
        json={
            "type": "location",
            "title": "Another location",
            "content": "Should be blocked while category is disabled",
        },
    )
    assert blocked_create.status_code == 403

    # Verify that re-enabling the permission affects subsequent requests
    client.put(
        "/permissions/location",
        json={"enabled": True},
    )
    restored_res = client.get(f"/events/{loc_id}")
    assert restored_res.status_code == 200
    assert restored_res.get_json()["id"] == loc_id

