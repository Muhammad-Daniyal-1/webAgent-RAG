"""
Conversation session store.

In-memory by default (resets on restart). If REDIS_URL is set, sessions are
persisted in Redis with a TTL so conversation state survives restarts and can
be shared across multiple backend workers.
"""
import os
import json


class SessionStore:
    def __init__(self):
        self._redis = None
        self._mem: dict[str, dict] = {}
        self.ttl = int(os.getenv("SESSION_TTL_SECONDS", "86400"))
        self._prefix = "webagent:session:"

        url = os.getenv("REDIS_URL")
        if url:
            try:
                import redis

                self._redis = redis.from_url(url, decode_responses=True)
                self._redis.ping()
                print("[session] Using Redis-backed session store")
            except Exception as e:  # pragma: no cover - depends on env
                print(f"[session] Redis unavailable ({e}); falling back to memory")
                self._redis = None

    def _key(self, session_id: str) -> str:
        return f"{self._prefix}{session_id}"

    def get(self, session_id: str, default: dict | None = None) -> dict | None:
        if self._redis:
            raw = self._redis.get(self._key(session_id))
            return json.loads(raw) if raw else default
        return self._mem.get(session_id, default)

    def set(self, session_id: str, value: dict) -> None:
        if self._redis:
            self._redis.set(self._key(session_id), json.dumps(value), ex=self.ttl)
        else:
            self._mem[session_id] = value


session_store = SessionStore()
