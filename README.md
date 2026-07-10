# WebAgent RAG — Self-Critiquing Agentic Chatbot

A production-grade AI chatbot system that crawls a website, builds a vector knowledge base, answers questions using Retrieval-Augmented Generation (RAG), critiques its own answers for hallucination, and captures leads by collecting visitor information and submitting contact forms — all autonomously.

Built as a portfolio project to demonstrate Python, FastAPI, LangGraph, RAG pipelines, agentic AI workflows, and full-stack engineering.

---

## What Makes This Different from Basic RAG

Most RAG demos retrieve chunks → generate an answer → done. This system goes further:

1. **Self-critiquing loop** — after generating an answer, a critic agent evaluates whether it is actually grounded in the retrieved chunks or hallucinated. If it fails, the system reformulates the query and retries up to 2 times before gracefully responding "I don't have enough information."

2. **Agentic lead capture** — when a visitor expresses interest in contacting the company, the bot switches into lead capture mode, collects their details conversationally (name, email, phone, company), and submits the contact form on their behalf via function calling.

3. **Website crawler** — give it any URL and it discovers, crawls, and indexes the entire site automatically. No manual copy-paste.

4. **Admin panel** — password-protected multi-page dashboard to manage the knowledge base, view chat sessions and leads, customize the embeddable widget, and monitor analytics.

5. **Embeddable widget** — the chat interface can be embedded on any company website as a floating widget with Shadow DOM isolation.

---

## Architecture

Each deployment indexes **one website** (or uploaded document) at a time. The admin panel, chat API, and embeddable widget all share that single knowledge base.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                            │
│                                                                      │
│   /                      Public demo chat (requires indexed content) │
│   /admin                 Admin login                                 │
│   /admin/dashboard       Analytics & charts                          │
│   /admin/knowledge       Crawl website / upload PDF                  │
│   /admin/sessions        Chat session logs                           │
│   /admin/leads           Captured leads + form status                │
│   /admin/widget          Widget styling + embed snippet              │
│   /admin/account         Password & admin user management            │
│                                                                      │
│   /api/admin/*           BFF proxy (httpOnly JWT cookie → backend)   │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────────────┐
│                      Backend (FastAPI)                                 │
│                                                                      │
│   POST /admin/login        Email + password → JWT                    │
│   POST /admin/crawl        Crawl a website (authenticated)           │
│   POST /admin/upload       Upload PDF/TXT (authenticated)            │
│   GET  /admin/site         Current indexed site                      │
│   GET  /admin/sessions     Chat session logs                         │
│   GET  /admin/leads        Captured leads                            │
│   GET  /admin/analytics    Usage + conversion metrics                │
│   GET  /status             Crawl progress polling                    │
│   POST /chat               Main chat endpoint                        │
│   POST /chat/stream        Streaming chat (SSE)                      │
│   GET  /widget.js          Embeddable widget script                  │
└───────┬──────────────────┬──────────────────────────────────────────┘
        │                  │
        ▼                  ▼
┌──────────────┐   ┌───────────────────────────────────────┐
│   SQLite DB  │   │         RAG Pipeline (LangGraph)       │
│              │   │                                        │
│  admin_users │   │  retrieve → generate → critic          │
│  sites (1)   │   │      ↓ fail                            │
│  sessions    │   │  reformulate → retrieve (retry ×2)     │
│  messages    │   │      ↓ still fail                      │
│  widget_cfg  │   │  fallback: "I don't have enough info"  │
└──────────────┘   │      ↓ pass                            │
                   │  lead capture agent (if intent found)  │
                   │  → collect fields → submit form        │
                   └──────────────┬─────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      ChromaDB (local)        │
                    │  sentence-transformers        │
                    │  all-MiniLM-L6-v2 embeddings │
                    └─────────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │         Groq API            │
                    │   openai/gpt-oss-120b        │
                    │   (free tier, fast)          │
                    └─────────────────────────────┘
```

---

## Tech Stack

| Layer          | Technology                                            |
| -------------- | ----------------------------------------------------- |
| Frontend       | Next.js 16, React 19, TypeScript, Tailwind CSS, Recharts |
| Backend        | FastAPI, Python 3.11+, Uvicorn                        |
| AI / LLM       | Groq API (gpt-oss-120b), LangChain, LangGraph         |
| RAG            | ChromaDB, sentence-transformers (all-MiniLM-L6-v2)    |
| Web Crawler    | Crawl4AI, Playwright                                  |
| Database       | SQLAlchemy — SQLite (default) / PostgreSQL (optional) |
| Sessions       | In-memory (default) / Redis (optional)                |
| Auth           | JWT (PyJWT) + bcrypt password hashing, httpOnly cookie BFF |
| PDF parsing    | pypdf                                                 |
| Form detection | BeautifulSoup4, httpx                                 |

---

## Project Structure

```
projectRag/
├── backend/
│   ├── main.py                  # FastAPI app, all routes
│   ├── database.py              # SQLAlchemy models (AdminUser, Site, ChatSession, ChatMessage, WidgetConfig)
│   ├── auth.py                  # bcrypt hashing + JWT login + admin seeding
│   ├── widget_config.py         # widget settings defaults + validation + DB access
│   ├── session_store.py         # in-memory / Redis conversation state
│   ├── requirements.txt
│   ├── .env.example             # template for backend secrets
│   ├── .env                     # secrets (not committed)
│   ├── webagent.db              # SQLite database (auto-created)
│   ├── chroma_db/               # ChromaDB vector store (auto-created)
│   ├── static/
│   │   └── widget.js            # self-contained embeddable chat widget
│   └── rag/
│       ├── __init__.py
│       ├── loader.py            # PDF + TXT document loading
│       ├── chunker.py           # RecursiveCharacterTextSplitter
│       ├── embedder.py          # ChromaDB + sentence-transformers
│       ├── retriever.py         # Similarity search over indexed chunks
│       ├── crawler.py           # Crawl4AI website crawler
│       ├── form_detector.py     # Contact form field extraction
│       └── graph.py             # LangGraph stateful agent graph (+ SSE streaming)
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Public demo chat interface
│   │   ├── layout.tsx           # Root layout + metadata
│   │   ├── api/
│   │   │   └── admin/
│   │   │       ├── login/route.ts       # Login → set httpOnly JWT cookie
│   │   │       ├── logout/route.ts      # Clear session cookie
│   │   │       └── [...path]/route.ts   # BFF proxy to backend admin API
│   │   └── admin/
│   │       ├── page.tsx                 # Admin login page
│   │       └── (panel)/
│   │           ├── layout.tsx           # AdminShell sidebar layout
│   │           ├── dashboard/page.tsx   # Analytics & charts
│   │           ├── knowledge/page.tsx   # Crawl / upload / schedule
│   │           ├── sessions/page.tsx    # Session logs
│   │           ├── leads/page.tsx       # Captured leads
│   │           ├── widget/page.tsx    # Widget customization
│   │           └── account/page.tsx     # Password & admin users
│   ├── components/
│   │   ├── ChatWindow.tsx       # Chat UI with verdict badges
│   │   └── admin/
│   │       ├── AdminShell.tsx   # Sidebar layout + auth check
│   │       ├── AdminSidebar.tsx # Navigation
│   │       ├── EmbedSnippet.tsx # Copy-paste embed code
│   │       ├── WidgetPreview.tsx
│   │       └── ui.tsx           # Shared admin UI primitives
│   ├── lib/
│   │   ├── config.ts            # Env-based API URL
│   │   └── admin/
│   │       ├── api.ts           # Client-side admin fetch helpers
│   │       ├── bff.ts           # Server-side proxy to backend
│   │       ├── cookies.ts       # httpOnly JWT cookie helpers
│   │       └── types.ts         # Shared TypeScript types
│   └── proxy.ts                 # Route guard for admin pages (cookie check)
├── .gitignore
└── README.md
```

---

## Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- A free [Groq API key](https://console.groq.com)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/projectRag.git
cd projectRag
```

### 2. Set up Python environment

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

### 3. Install backend dependencies

```bash
pip install -r backend/requirements.txt
playwright install chromium
```

### 4. Configure environment variables

Copy the example file and fill in your values:

```bash
cp backend/.env.example backend/.env
```

```env
GROQ_API_KEY=your_groq_api_key_here
# The first admin account is seeded from these on first startup
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password_here
ADMIN_SECRET=your-jwt-secret-key-minimum-32-characters-long
ADMIN_TOKEN_TTL_HOURS=24
# Comma-separated frontend origins allowed to call the API ("*" for dev only)
ALLOWED_ORIGINS=*
# How often (minutes) to check for scheduled re-crawls
RECRAWL_CHECK_MINUTES=60
```

Get your free Groq API key at [console.groq.com](https://console.groq.com).

> **Admin accounts:** On first startup, an admin user is created from
> `ADMIN_EMAIL` / `ADMIN_PASSWORD` (passwords are bcrypt-hashed, never stored in
> plain text). Log in with that email + password. You can add more admins or
> change your password from the **Account** page. Changing `ADMIN_PASSWORD` later has
> no effect once an admin already exists — use the admin panel instead.

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

### 6. Configure the frontend

Create `frontend/.env.local` with your backend URL:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running the Project

Every time you start working, open two terminal windows:

**Terminal 1 — Backend**

```bash
cd projectRag
source venv/bin/activate
cd backend
uvicorn main:app --reload
```

Backend runs at: `http://localhost:8000`  
API docs (Swagger UI): `http://localhost:8000/docs`

**Terminal 2 — Frontend**

```bash
cd projectRag/frontend
npm run dev
```

Frontend runs at: `http://localhost:3000`

---

## Usage

### 1. Index content (Admin → Knowledge)

Log in at `http://localhost:3000/admin`, then open **Knowledge**:

1. Enter a website URL (e.g. `https://yourcompany.com`) and click **Crawl website**, or upload a PDF/TXT file
2. Wait 20–40 seconds for the crawler to finish indexing
3. Optionally set an auto re-crawl schedule (daily / weekly / monthly)
4. A green **✓ contact form** badge appears when a form was detected on the site

> Each deployment holds **one** indexed source at a time. Starting a new crawl or upload replaces the previous index.

### 2. Public demo chat — `http://localhost:3000`

Once content is indexed via the admin panel:

1. Ask questions about the website in the chat
2. Each answer shows a **✓ grounded** or **✗ ungrounded** badge — the critic agent's verdict
3. If the bot detects buying intent, it offers to connect the visitor with the company
4. Clicking **Yes, connect me** starts the lead capture flow — the bot collects details and submits the contact form

### 3. Admin panel — `http://localhost:3000/admin`

Login with the admin email + password (seeded from `.env` on first startup).

| Page | What it does |
| ---- | ------------ |
| **Dashboard** | Sites indexed, sessions, questions asked, leads captured, lead conversion rate, grounded-answer rate, average retries, and 10-day trend charts |
| **Knowledge** | Crawl a website or upload a PDF/TXT, view crawl status, set re-crawl schedule, delete the index |
| **Sessions** | Browse every chat session; click to view the full message log with verdict, mode, and retry count per message |
| **Leads** | View captured leads with contact details, form submission status, and detected contact form schema |
| **Widget** | Customize appearance (bot name, colors, theme, position, language, suggested questions) with live preview; copy the embed snippet |
| **Account** | Change your password and create additional admin users |

Admin API calls are proxied through the Next.js BFF (`/api/admin/*`) using an httpOnly JWT cookie — the token never reaches client-side JavaScript.

---

## Embedding the Widget on Any Site

From the admin **Widget** page, copy the snippet and paste it before `</body>` on any website:

```html
<script src="https://your-backend.com/widget.js"
        data-api-url="https://your-backend.com"
        async></script>
```

The widget is a self-contained script (no dependencies) that renders an isolated
floating chat bubble using Shadow DOM, pulls its styling from `/widget/config`,
and talks to the `/chat` endpoint.

---

## How the RAG Pipeline Works

### Document ingestion flow

```
URL or file
    ↓
crawler.py      Crawl4AI fetches clean markdown from every page
    ↓
loader.py       Reads PDF / TXT into raw text
    ↓
chunker.py      Splits into 500-character chunks with 50-char overlap
    ↓
embedder.py     Converts chunks to vectors using all-MiniLM-L6-v2
    ↓
ChromaDB        Stores vectors on disk for similarity search
```

### Query flow (self-critiquing loop)

```
User question
    ↓
retriever.py    Embed question → find top-3 similar chunks
    ↓
generate        Groq LLM answers using chunks as context only
    ↓
critic          Second LLM call: "Is this answer grounded in the chunks?"
    ↓
verdict = pass  → Return answer to user
verdict = fail  → Reformulate query → retry (max 2 times)
still failing   → "I don't have enough information"
```

### Lead capture flow

```
Visitor expresses contact intent
    ↓
Mode switches to "lead_capture"
    ↓
Bot asks for required fields one at a time
(firstName, email, phone, companyName, subject)
    ↓
Optional fields offered with skip option
    ↓
httpx submits collected data to contact form endpoint
    ↓
Session marked as lead_captured = true in database
```

---

## API Reference

| Method | Endpoint                 | Auth   | Description                       |
| ------ | ------------------------ | ------ | --------------------------------- |
| POST   | `/admin/login`           | None   | Email + password → JWT token      |
| GET    | `/admin/me`              | Bearer | Current admin's email             |
| POST   | `/admin/change-password` | Bearer | Change the current admin password |
| GET    | `/admin/users`           | Bearer | List admin users                  |
| POST   | `/admin/users`           | Bearer | Create a new admin user           |
| POST   | `/admin/crawl`           | Bearer | Start website crawl               |
| POST   | `/admin/upload`          | Bearer | Upload PDF or TXT                 |
| GET    | `/admin/site`            | Bearer | Get the current indexed site      |
| PATCH  | `/admin/site/schedule`   | Bearer | Set auto re-crawl interval        |
| DELETE | `/admin/site`            | Bearer | Remove site and clear vectors     |
| GET    | `/admin/sessions`        | Bearer | List chat sessions                |
| GET    | `/admin/sessions/:id`    | Bearer | Get session message log           |
| GET    | `/admin/leads`           | Bearer | List captured leads               |
| GET    | `/admin/analytics`       | Bearer | Usage + conversion metrics        |
| GET    | `/admin/widget/config`   | Bearer | Get widget config                 |
| PUT    | `/admin/widget/config`   | Bearer | Update widget config              |
| GET    | `/widget/config`         | None   | Public widget config              |
| GET    | `/widget.js`             | None   | Embeddable widget script          |
| GET    | `/status`                | None   | Poll crawl progress               |
| POST   | `/chat`                  | None   | Send a message                    |
| POST   | `/chat/stream`           | None   | Send a message (SSE streaming)    |

### Chat request body

```json
{
  "question": "What services do you offer?",
  "session_id": "optional-uuid-for-conversation-continuity"
}
```

### Chat response

```json
{
  "answer": "Vortanex offers mobile app development, AI/ML, blockchain...",
  "verdict": "pass",
  "retries": 0,
  "suggest_contact": true,
  "session_id": "ef4c37ff-c2fa-4b4d-ab11-d8a0b0f97819",
  "mode": "rag"
}
```

`verdict` — `"pass"` means the answer is grounded in retrieved documents. `"fail"` means the critic detected a hallucination.  
`retries` — how many times the query was reformulated before a passing answer was found.  
`mode` — `"rag"` for normal answers, `"lead_capture"` when collecting contact details.

---

## Known Limitations

- **Single-site model** — each deployment indexes one website or document at a time. Starting a new crawl or upload replaces the previous index.
- **JavaScript-rendered contact forms** — many modern sites (Next.js, React) render forms client-side, so the form submission step may not work. The bot will inform the user and provide the direct contact URL instead.
- **Session store** — defaults to in-memory (resets on restart). Set `REDIS_URL` to persist conversation state across restarts and workers.
- **Database** — defaults to SQLite. Set `DATABASE_URL` to a hosted Postgres for production (`postgresql+psycopg://...`; uncomment `psycopg[binary]` in `requirements.txt`).

---

## Roadmap

- [x] Streaming responses (SSE) for faster perceived latency
- [x] Embeddable `<script>` widget for third-party sites
- [x] PostgreSQL + Redis for production persistence _(optional, env-activated)_
- [x] Re-crawl scheduling (daily / weekly / monthly refresh of indexed content)
- [x] Analytics dashboard (questions asked, lead conversion rate, grounded rate)
- [x] Multi-language support _(per-widget language setting)_
- [x] Admin accounts with hashed passwords + widget styling manager
- [x] Multi-page admin panel with dedicated leads, sessions, and knowledge pages
- [x] BFF auth layer (httpOnly cookie proxy for admin API)

---

## Author

**HM Daniyal** — Senior Full-Stack Engineer

<!-- [LinkedIn](https://linkedin.com/in/your-profile) · [GitHub](https://github.com/your-username) · daniyalwarsi12@gmail.com -->
