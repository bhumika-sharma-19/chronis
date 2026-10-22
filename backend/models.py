
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

    def __init__(self, name=None, id=None, **kwargs):
        super().__init__(**kwargs)
        if name is not None:
            self.name = name
        if id is not None:
            self.id = id

class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    timestamp = db.Column(
        db.DateTime,
        nullable=False
    )

    type = db.Column(
        db.String(30),
        nullable=False
    )

    title = db.Column(
        db.String(200),
        nullable=False
    )

    content = db.Column(
        db.Text,
        nullable=False
    )

    def __init__(
        self,
        user_id=None,
        timestamp=None,
        type=None,
        title=None,
        content=None,
        id=None,
        **kwargs
    ):
        super().__init__(**kwargs)
        if user_id is not None:
            self.user_id = user_id
        if timestamp is not None:
            self.timestamp = timestamp
        if type is not None:
            self.type = type
        if title is not None:
            self.title = title
        if content is not None:
            self.content = content
        if id is not None:
            self.id = id

class Permission(db.Model):
    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    event_type = db.Column(
        db.String(30),
        nullable=False
    )

    enabled = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "event_type",
            name="unique_user_permission"
        ),
    )

    def __init__(
        self,
        user_id=None,
        event_type=None,
        enabled=True,
        id=None,
        **kwargs
    ):
        super().__init__(**kwargs)
        if user_id is not None:
            self.user_id = user_id
        if event_type is not None:
            self.event_type = event_type
        self.enabled = enabled
        if id is not None:
            self.id = id

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    action = db.Column(
        db.String(50),
        nullable=False
    )

    event_type = db.Column(
        db.String(30),
        nullable=True
    )

    result = db.Column(
        db.String(30),
        nullable=False
    )

    def __init__(
        self,
        user_id=None,
        action=None,
        event_type=None,
        result=None,
        timestamp=None,
        id=None,
        **kwargs
    ):
        super().__init__(**kwargs)
        if user_id is not None:
            self.user_id = user_id
        if action is not None:
            self.action = action
        if event_type is not None:
            self.event_type = event_type
        if result is not None:
            self.result = result
        if timestamp is not None:
            self.timestamp = timestamp
        if id is not None:
            self.id = id
