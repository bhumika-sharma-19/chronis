
import pytest
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

    response = client.get("/audit-log")

    assert response.status_code == 200
    data = response.get_json()
    logs = data["audit_logs"]

    assert len(logs) > 0
    assert any(log["action"] for log in logs)
