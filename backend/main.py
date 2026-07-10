from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import shutil, os, uuid, json, asyncio

from database import init_db, get_db, get_site, Site, ChatSession, ChatMessage, AdminUser
from widget_config import get_config as get_widget_config, save_config as save_widget_config
from session_store import session_store
from auth import (
    create_token,
    verify_token,
    authenticate,
    seed_admin,
    hash_password,
    verify_password,
)
from rag.loader import load_document
from rag.chunker import chunk_text
from rag.form_detector import detect_contact_form

load_dotenv()
init_db()
seed_admin()

RECRAWL_CHECK_MINUTES = int(os.getenv("RECRAWL_CHECK_MINUTES", "60"))


def _site_to_dict(site: Site) -> dict:
    return {
        "id": site.id,
        "url": site.url,
        "status": site.status,
        "pages_crawled": site.pages_crawled,
        "chunks_indexed": site.chunks_indexed,
        "has_contact_form": site.contact_form is not None,
        "refresh_interval_hours": site.refresh_interval_hours or 0,
        "last_crawled": site.last_crawled,
        "created_at": site.created_at,
    }


async def _recrawl_loop():
    """Periodically re-crawl the site when its refresh interval has elapsed."""
    while True:
        await asyncio.sleep(RECRAWL_CHECK_MINUTES * 60)
        try:
            db = next(get_db())
            site = get_site(db)
            if not site or site.refresh_interval_hours <= 0 or site.status == "processing":
                db.close()
                continue
            if (site.url or "").startswith("file://"):
                db.close()
                continue
            now = datetime.utcnow()
            last = site.last_crawled or site.created_at or now
            if last + timedelta(hours=site.refresh_interval_hours) <= now:
                site.status = "processing"
                db.commit()
                url, max_pages = site.url, site.max_pages or 30
                db.close()
                print(f"[recrawl] refreshing {url}")
                await process_site(url, max_pages)
            else:
                db.close()
        except Exception as e:
            print(f"[recrawl] loop error: {e}")


@asynccontextmanager
async def lifespan(app: "FastAPI"):
    task = asyncio.create_task(_recrawl_loop())
    yield
    task.cancel()


app = FastAPI(title="WebAgent RAG API", lifespan=lifespan)

_allowed = os.getenv("ALLOWED_ORIGINS", "*").strip()
allow_origins = ["*"] if _allowed == "*" else [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class CreateUserRequest(BaseModel):
    email: str
    password: str

class WidgetConfigRequest(BaseModel):
    config: dict

class ScheduleRequest(BaseModel):
    refresh_interval_hours: int

class CrawlRequest(BaseModel):
    url: str
    max_pages: int = 30

class ChatRequest(BaseModel):
    question: str
    session_id: str | None = None

class ChatResponse(BaseModel):
    answer: str
    verdict: str
    retries: int
    suggest_contact: bool
    session_id: str
    mode: str

# ─────────────────────────────────────────
# Auth
# ─────────────────────────────────────────
@app.post("/admin/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(user.email), "email": user.email}

@app.get("/admin/me", dependencies=[Depends(verify_token)])
def get_me(email: str = Depends(verify_token)):
    return {"email": email}

@app.post("/admin/change-password")
def change_password(
    req: ChangePasswordRequest,
    email: str = Depends(verify_token),
    db: Session = Depends(get_db),
):
    user = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not user or not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(
            status_code=400, detail="New password must be at least 8 characters"
        )
    user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated"}

@app.get("/admin/users", dependencies=[Depends(verify_token)])
def list_users(db: Session = Depends(get_db)):
    users = db.query(AdminUser).order_by(AdminUser.created_at.asc()).all()
    return [
        {"id": u.id, "email": u.email, "is_active": u.is_active, "created_at": u.created_at}
        for u in users
    ]

@app.post("/admin/users", dependencies=[Depends(verify_token)])
def create_user(req: CreateUserRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if len(req.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    if db.query(AdminUser).filter(AdminUser.email == email).first():
        raise HTTPException(status_code=400, detail="An admin with this email already exists")
    user = AdminUser(email=email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    return {"id": user.id, "email": user.email}

# ─────────────────────────────────────────
# Admin — Widget configuration
# ─────────────────────────────────────────
@app.get("/admin/widget/config", dependencies=[Depends(verify_token)])
def admin_get_widget_config(db: Session = Depends(get_db)):
    return {"config": get_widget_config(db)}

@app.put("/admin/widget/config", dependencies=[Depends(verify_token)])
def admin_save_widget_config(req: WidgetConfigRequest, db: Session = Depends(get_db)):
    config = save_widget_config(db, req.config)
    return {"config": config}

# ─────────────────────────────────────────
# Admin — Site (singleton)
# ─────────────────────────────────────────
@app.post("/admin/crawl", dependencies=[Depends(verify_token)])
async def admin_crawl(
    request: CrawlRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    from rag.embedder import clear_collection

    clear_collection()
    db.query(Site).delete()
    site = Site(
        url=request.url,
        status="processing",
        max_pages=request.max_pages,
    )
    db.add(site)
    db.commit()

    background_tasks.add_task(process_site, request.url, request.max_pages)
    return {"message": f"Crawling started for {request.url}"}

@app.get("/admin/site", dependencies=[Depends(verify_token)])
def get_admin_site(db: Session = Depends(get_db)):
    site = get_site(db)
    if not site:
        raise HTTPException(status_code=404, detail="No site indexed yet")
    return _site_to_dict(site)

@app.patch("/admin/site/schedule", dependencies=[Depends(verify_token)])
def set_site_schedule(req: ScheduleRequest, db: Session = Depends(get_db)):
    site = get_site(db)
    if not site:
        raise HTTPException(status_code=404, detail="No site indexed yet")
    site.refresh_interval_hours = max(0, req.refresh_interval_hours)
    db.commit()
    return {"refresh_interval_hours": site.refresh_interval_hours}

@app.delete("/admin/site", dependencies=[Depends(verify_token)])
def delete_site(db: Session = Depends(get_db)):
    from rag.embedder import clear_collection

    clear_collection()
    db.query(Site).delete()
    db.commit()
    return {"message": "Site and index cleared"}

@app.post("/admin/upload", dependencies=[Depends(verify_token)])
async def admin_upload(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from rag.embedder import clear_collection, embed_chunks

    allowed = [".pdf", ".txt"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF and TXT files allowed")

    tmp_path = f"/tmp/{uuid.uuid4()}{ext}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    text = load_document(tmp_path)
    chunks = chunk_text(text)
    doc_id = file.filename.replace(" ", "_")

    clear_collection()
    db.query(Site).delete()
    embed_chunks(chunks, doc_id)
    os.remove(tmp_path)

    site = Site(
        url=f"file://{file.filename}",
        status="ready",
        pages_crawled=1,
        chunks_indexed=len(chunks),
    )
    db.add(site)
    db.commit()

    return {"message": f"Indexed {len(chunks)} chunks from {file.filename}"}

# ─────────────────────────────────────────
# Admin — Sessions & Logs
# ─────────────────────────────────────────
@app.get("/admin/sessions", dependencies=[Depends(verify_token)])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).order_by(ChatSession.created_at.desc()).limit(100).all()
    return [
        {
            "session_id": s.session_id,
            "lead_captured": s.lead_captured,
            "created_at": s.created_at,
        }
        for s in sessions
    ]


@app.get("/admin/leads", dependencies=[Depends(verify_token)])
def list_leads(db: Session = Depends(get_db)):
    site = get_site(db)
    contact_form = None
    if site and site.contact_form:
        try:
            contact_form = json.loads(site.contact_form)
        except json.JSONDecodeError:
            contact_form = None

    leads = (
        db.query(ChatSession)
        .filter(ChatSession.lead_captured == True)
        .order_by(ChatSession.lead_captured_at.desc(), ChatSession.created_at.desc())
        .limit(200)
        .all()
    )

    return {
        "contact_form": contact_form,
        "leads": [
            {
                "session_id": s.session_id,
                "data": json.loads(s.lead_data) if s.lead_data else {},
                "form_submitted": bool(s.form_submitted),
                "captured_at": s.lead_captured_at or s.created_at,
                "created_at": s.created_at,
            }
            for s in leads
        ],
    }


CHART_DAYS = 10


def _fill_last_n_days(rows, n: int = CHART_DAYS) -> list[dict]:
    """Return the last n calendar days including today, with 0 for missing days."""
    counts = {str(d): c for d, c in rows}
    today = datetime.utcnow().date()
    return [
        {
            "day": str(today - timedelta(days=offset)),
            "count": counts.get(str(today - timedelta(days=offset)), 0),
        }
        for offset in range(n - 1, -1, -1)
    ]


@app.get("/admin/analytics", dependencies=[Depends(verify_token)])
def analytics(db: Session = Depends(get_db)):
    site = get_site(db)
    total_sessions = db.query(func.count(ChatSession.id)).scalar() or 0
    total_leads = (
        db.query(func.count(ChatSession.id))
        .filter(ChatSession.lead_captured == True)
        .scalar()
        or 0
    )

    assistant_msgs = db.query(ChatMessage).filter(ChatMessage.role == "assistant")
    total_answers = assistant_msgs.count()
    passed = assistant_msgs.filter(ChatMessage.verdict == "pass").count()
    total_questions = (
        db.query(func.count(ChatMessage.id))
        .filter(ChatMessage.role == "user")
        .scalar()
        or 0
    )
    avg_retries = (
        db.query(func.avg(ChatMessage.retries))
        .filter(ChatMessage.role == "assistant")
        .scalar()
        or 0
    )

    rows = (
        db.query(
            func.date(ChatMessage.created_at).label("day"),
            func.count(ChatMessage.id),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    per_day = _fill_last_n_days(rows)

    session_rows = (
        db.query(
            func.date(ChatSession.created_at).label("day"),
            func.count(ChatSession.id),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )
    sessions_per_day = _fill_last_n_days(session_rows)

    lead_rows = (
        db.query(
            func.date(ChatSession.created_at).label("day"),
            func.count(ChatSession.id),
        )
        .filter(ChatSession.lead_captured == True)
        .group_by("day")
        .order_by("day")
        .all()
    )
    leads_per_day = _fill_last_n_days(lead_rows)

    return {
        "site_indexed": site is not None and site.status == "ready",
        "site_url": site.url if site else None,
        "total_sessions": total_sessions,
        "total_questions": total_questions,
        "total_leads": total_leads,
        "lead_conversion_rate": round(total_leads / total_sessions, 3) if total_sessions else 0,
        "grounded_rate": round(passed / total_answers, 3) if total_answers else 0,
        "avg_retries": round(float(avg_retries), 2),
        "messages_per_day": per_day,
        "sessions_per_day": sessions_per_day,
        "leads_per_day": leads_per_day,
    }

@app.get("/admin/sessions/{session_id}", dependencies=[Depends(verify_token)])
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "role": m.role,
            "content": m.content,
            "verdict": m.verdict,
            "retries": m.retries,
            "mode": m.mode,
            "created_at": m.created_at,
        }
        for m in messages
    ]

# ─────────────────────────────────────────
# Public — Widget config + Status + Chat
# ─────────────────────────────────────────
@app.get("/widget/config")
def public_widget_config(db: Session = Depends(get_db)):
    return {"config": get_widget_config(db)}

WIDGET_JS_PATH = os.path.join(os.path.dirname(__file__), "static", "widget.js")

@app.get("/widget.js")
def widget_js():
    return FileResponse(
        WIDGET_JS_PATH,
        media_type="application/javascript",
        headers={"Cache-Control": "public, max-age=300"},
    )

@app.get("/status")
def get_status(db: Session = Depends(get_db)):
    site = get_site(db)
    if not site:
        raise HTTPException(status_code=404, detail="No site indexed yet")
    return {
        "status": site.status,
        "url": site.url,
        "pages_crawled": site.pages_crawled,
        "chunks_indexed": site.chunks_indexed,
        "contact_form": json.loads(site.contact_form) if site.contact_form else None,
    }

_STRONG_INTENT = [
    "i want to contact", "i'd like to contact", "i want to reach out",
    "connect me", "i want to talk", "let me contact", "i want to get in touch",
    "yes i want", "yes please", "book a call", "get a quote", "request a demo",
    "help me contact", "help me to contact", "help me reach", "help me get in touch",
    "can you contact", "can you help me contact", "can you help me to contact",
    "contact him", "contact her", "contact them", "reach him", "reach her",
    "reach them", "get in touch with him", "get in touch with her",
    "get in touch with them", "connect with him", "connect with her",
    "connect with them", "i want to reach him", "i want to reach her",
]
_SOFT_INTENT = ["contact", "reach", "interested", "buy", "pricing", "demo", "quote"]
_SOFT_ACTION_HINTS = [
    "help", "want", "like", "need", "please", "can you", "could you",
    "would you", "let me", "connect", "talk", "message", "email", "call",
]


def _load_contact_form(db: Session, session: dict) -> None:
    if session.get("contact_form"):
        return
    site = get_site(db)
    if site and site.contact_form:
        session["contact_form"] = json.loads(site.contact_form)


def _prepare_chat(request: ChatRequest, db: Session):
    """Shared setup for /chat and /chat/stream: session, intent, graph state."""
    session_id = request.session_id or str(uuid.uuid4())

    db_session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not db_session:
        db_session = ChatSession(session_id=session_id)
        db.add(db_session)
        db.commit()

    session = session_store.get(session_id, {
        "mode": "rag",
        "collected": {},
        "next_field": None,
        "contact_form": None,
        "retries": 0,
    })

    _load_contact_form(db, session)

    question_lower = request.question.lower()
    strong_match = any(p in question_lower for p in _STRONG_INTENT)
    soft_match = any(k in question_lower for k in _SOFT_INTENT)
    soft_action = any(h in question_lower for h in _SOFT_ACTION_HINTS)
    user_wants_contact = strong_match or soft_match

    wants_lead_capture = strong_match or (soft_match and soft_action)
    if (
        wants_lead_capture
        and session["mode"] == "rag"
        and session.get("contact_form")
    ):
        session["mode"] = "lead_capture"

    db.add(ChatMessage(
        session_id=session_id, role="user",
        content=request.question, mode=session["mode"],
    ))
    db.commit()

    widget_cfg = get_widget_config(db)
    state = {
        "question": request.question,
        "reformulated_query": "",
        "chunks": [],
        "answer": "",
        "verdict": "pass",
        "retries": session.get("retries", 0),
        "mode": session["mode"],
        "contact_form": session.get("contact_form"),
        "collected": session.get("collected", {}),
        "next_field": session.get("next_field"),
        "form_submitted": False,
        "language": widget_cfg.get("language", "auto"),
    }
    return session_id, db_session, session, state, user_wants_contact


def _finalize_chat(db, session_id, db_session, session, result, user_wants_contact) -> bool:
    """Persist results and return whether to suggest contact."""
    session_store.set(session_id, {
        "mode": result.get("mode", "rag"),
        "collected": result.get("collected", {}),
        "next_field": result.get("next_field"),
        "contact_form": session.get("contact_form"),
        "retries": result.get("retries", 0),
    })

    if result.get("lead_complete"):
        collected = result.get("collected", {})
        clean = {k: v for k, v in collected.items() if str(v).lower() != "skip"}
        db_session.lead_captured = True
        db_session.lead_data = json.dumps(clean)
        db_session.form_submitted = bool(result.get("form_submitted"))
        db_session.lead_captured_at = datetime.utcnow()
        db.commit()
    elif result.get("form_submitted"):
        db_session.lead_captured = True
        db.commit()

    db.add(ChatMessage(
        session_id=session_id, role="assistant",
        content=result["answer"], verdict=result.get("verdict", "pass"),
        retries=result.get("retries", 0), mode=result.get("mode", "rag"),
    ))
    db.commit()

    return (
        not user_wants_contact
        and result.get("mode") == "rag"
        and session.get("contact_form") is not None
        and any(kw in result.get("answer", "").lower()
                for kw in ["service", "offer", "help", "provide", "build"])
    )


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    from rag.graph import rag_graph

    session_id, db_session, session, state, wants_contact = _prepare_chat(request, db)
    result = rag_graph.invoke(state)
    suggest_contact = _finalize_chat(db, session_id, db_session, session, result, wants_contact)
    return ChatResponse(
        answer=result["answer"],
        verdict=result.get("verdict", "pass"),
        retries=result.get("retries", 0),
        suggest_contact=suggest_contact,
        session_id=session_id,
        mode=result.get("mode", "rag"),
    )


@app.post("/chat/stream")
def chat_stream(request: ChatRequest, db: Session = Depends(get_db)):
    from fastapi.responses import StreamingResponse
    from rag.graph import stream_chat

    session_id, db_session, session, state, wants_contact = _prepare_chat(request, db)

    def event_gen():
        def sse(event: str, data: dict) -> str:
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        yield sse("session", {"session_id": session_id})
        final_result = None
        try:
            for kind, payload in stream_chat(state):
                if kind == "token":
                    yield sse("token", {"text": payload})
                elif kind == "reset":
                    yield sse("reset", {})
                elif kind == "final":
                    final_result = payload
        except Exception as e:
            print(f"[stream] error: {e}")
            final_result = {**state, "answer": "Sorry, something went wrong.", "verdict": "fail"}
            yield sse("token", {"text": final_result["answer"]})

        suggest_contact = _finalize_chat(
            db, session_id, db_session, session, final_result or state, wants_contact
        )
        yield sse("done", {
            "verdict": (final_result or {}).get("verdict", "pass"),
            "retries": (final_result or {}).get("retries", 0),
            "mode": (final_result or {}).get("mode", "rag"),
            "suggest_contact": suggest_contact,
            "session_id": session_id,
        })

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def process_site(url: str, max_pages: int):
    from rag.crawler import crawl_website
    from rag.embedder import embed_chunks

    db = next(get_db())
    try:
        pages = await crawl_website(url, max_pages=max_pages)
        total_chunks = 0
        for page_url, content in pages.items():
            if not content.strip():
                continue
            chunks = chunk_text(content)
            embed_chunks(chunks, doc_id=page_url)
            total_chunks += len(chunks)

        form_info = await detect_contact_form(url)

        site = get_site(db)
        if site:
            site.status = "ready"
            site.pages_crawled = len(pages)
            site.chunks_indexed = total_chunks
            site.contact_form = json.dumps(form_info) if form_info else None
            site.last_crawled = datetime.utcnow()
            db.commit()

    except Exception as e:
        site = get_site(db)
        if site:
            site.status = "error"
            db.commit()
        print(f"Crawl error: {e}")
    finally:
        db.close()
