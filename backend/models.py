
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

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
