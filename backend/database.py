import os
from sqlalchemy import create_engine, Column, String, Integer, Boolean, Text, DateTime, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./webagent.db")

_connect_args = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
_engine_kwargs = {"connect_args": _connect_args}
if not DATABASE_URL.startswith("sqlite"):
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class AdminUser(Base):
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Site(Base):
    """Singleton row — one deployment indexes one website."""
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    status = Column(String, default="processing")
    pages_crawled = Column(Integer, default=0)
    chunks_indexed = Column(Integer, default=0)
    contact_form = Column(Text, nullable=True)
    max_pages = Column(Integer, default=30)
    refresh_interval_hours = Column(Integer, default=0)
    last_crawled = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    lead_captured = Column(Boolean, default=False)
    lead_data = Column(Text, nullable=True)
    form_submitted = Column(Boolean, default=False)
    lead_captured_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    role = Column(String)
    content = Column(Text)
    verdict = Column(String, nullable=True)
    retries = Column(Integer, default=0)
    mode = Column(String, default="rag")
    created_at = Column(DateTime, default=datetime.utcnow)


class WidgetConfig(Base):
    __tablename__ = "widget_configs"
    id = Column(Integer, primary_key=True, index=True)
    config = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def get_site(db: Session) -> Site | None:
    return db.query(Site).order_by(Site.id.desc()).first()


def _ensure_sites_columns():
    inspector = inspect(engine)
    if "sites" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("sites")}
    required_columns = {
        "max_pages": "INTEGER DEFAULT 30",
        "refresh_interval_hours": "INTEGER DEFAULT 0",
        "last_crawled": "DATETIME",
    }

    missing = {
        column: definition
        for column, definition in required_columns.items()
        if column not in existing_columns
    }
    if not missing:
        return

    with engine.begin() as conn:
        for column, definition in missing.items():
            conn.execute(text(f"ALTER TABLE sites ADD COLUMN {column} {definition}"))


def _ensure_chat_sessions_columns():
    inspector = inspect(engine)
    if "chat_sessions" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("chat_sessions")}
    required_columns = {
        "lead_data": "TEXT",
        "form_submitted": "BOOLEAN DEFAULT 0",
        "lead_captured_at": "DATETIME",
    }

    missing = {
        column: definition
        for column, definition in required_columns.items()
        if column not in existing_columns
    }
    if not missing:
        return

    with engine.begin() as conn:
        for column, definition in missing.items():
            conn.execute(text(f"ALTER TABLE chat_sessions ADD COLUMN {column} {definition}"))


def init_db():
    Base.metadata.create_all(bind=engine)
    _ensure_sites_columns()
    _ensure_chat_sessions_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
