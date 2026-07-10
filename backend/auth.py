import os, jwt, bcrypt
from datetime import datetime, timedelta
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import AdminUser, SessionLocal

load_dotenv()

SECRET_KEY = os.getenv("ADMIN_SECRET", "change-this-secret")
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = int(os.getenv("ADMIN_TOKEN_TTL_HOURS", "24"))
bearer_scheme = HTTPBearer()

# ─────────────────────────────────────────
# Password hashing (bcrypt)
# ─────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False

# ─────────────────────────────────────────
# JWT
# ─────────────────────────────────────────
def create_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> str:
    """Validates the JWT and returns the admin email (sub)."""
    try:
        payload = jwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        email = payload.get("sub")
        if not email:
            raise ValueError("missing subject")
        return email
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# ─────────────────────────────────────────
# Authentication helpers
# ─────────────────────────────────────────
def authenticate(db: Session, email: str, password: str) -> AdminUser | None:
    user = (
        db.query(AdminUser)
        .filter(AdminUser.email == email.lower().strip(), AdminUser.is_active == True)
        .first()
    )
    if user and verify_password(password, user.password_hash):
        return user
    return None

def seed_admin() -> None:
    """
    Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admins exist.
    Safe to call on every startup — it is a no-op once an admin exists.
    """
    email = os.getenv("ADMIN_EMAIL", "").lower().strip()
    password = os.getenv("ADMIN_PASSWORD", "")
    if not email or not password:
        return

    db = SessionLocal()
    try:
        if db.query(AdminUser).count() > 0:
            return
        db.add(AdminUser(email=email, password_hash=hash_password(password)))
        db.commit()
        print(f"[auth] Seeded initial admin user: {email}")
    finally:
        db.close()
