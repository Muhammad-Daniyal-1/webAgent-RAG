"""Widget configuration: defaults, validation, and DB access helpers."""
import json
from sqlalchemy.orm import Session

from database import WidgetConfig

# The canonical set of widget settings. Anything not present in a stored
# config falls back to these values, so older rows keep working as we add keys.
DEFAULT_WIDGET_CONFIG: dict = {
    "bot_name": "Assistant",
    "title": "Chat with us",
    "welcome_message": "Hi! Ask me anything about this site.",
    "placeholder": "Type your message...",
    "primary_color": "#2563eb",
    "text_color": "#ffffff",
    "bubble_icon": "💬",
    "position": "bottom-right",          # bottom-right | bottom-left
    "theme": "dark",                      # dark | light
    "launcher_label": "",                 # optional text next to the bubble
    "show_branding": True,
    "language": "auto",                   # auto | en | es | fr | de | ...
    "suggested_questions": [],            # list[str] shown as quick replies
}

_ALLOWED_POSITIONS = {"bottom-right", "bottom-left"}
_ALLOWED_THEMES = {"dark", "light"}


def merge_with_defaults(stored: dict | None) -> dict:
    merged = {**DEFAULT_WIDGET_CONFIG, **(stored or {})}
    return {k: merged.get(k, DEFAULT_WIDGET_CONFIG[k]) for k in DEFAULT_WIDGET_CONFIG}


def sanitize(incoming: dict) -> dict:
    """Coerce/validate an incoming config patch into safe values."""
    clean: dict = {}
    for key, value in (incoming or {}).items():
        if key not in DEFAULT_WIDGET_CONFIG:
            continue
        default = DEFAULT_WIDGET_CONFIG[key]
        if isinstance(default, bool):
            clean[key] = bool(value)
        elif isinstance(default, list):
            if isinstance(value, list):
                clean[key] = [str(v) for v in value][:6]
        else:
            clean[key] = str(value)
    if "position" in clean and clean["position"] not in _ALLOWED_POSITIONS:
        clean["position"] = DEFAULT_WIDGET_CONFIG["position"]
    if "theme" in clean and clean["theme"] not in _ALLOWED_THEMES:
        clean["theme"] = DEFAULT_WIDGET_CONFIG["theme"]
    return clean


def get_config(db: Session) -> dict:
    row = db.query(WidgetConfig).first()
    stored = json.loads(row.config) if row and row.config else {}
    return merge_with_defaults(stored)


def save_config(db: Session, patch: dict) -> dict:
    row = db.query(WidgetConfig).first()
    existing = json.loads(row.config) if row and row.config else {}
    updated = {**existing, **sanitize(patch)}
    payload = json.dumps(updated)
    if row:
        row.config = payload
    else:
        db.add(WidgetConfig(config=payload))
    db.commit()
    return merge_with_defaults(updated)
