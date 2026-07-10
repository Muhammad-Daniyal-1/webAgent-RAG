from typing import TypedDict
from langgraph.graph import StateGraph, END
from .retriever import retrieve
import os, httpx, json, asyncio
from dotenv import load_dotenv

load_dotenv()

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        from langchain_groq import ChatGroq

        _llm = ChatGroq(
            model="openai/gpt-oss-120b",
            api_key=os.getenv("GROQ_API_KEY"),
        )
    return _llm

# ─────────────────────────────────────────
# State
# ─────────────────────────────────────────
class RAGState(TypedDict):
    question: str
    reformulated_query: str
    chunks: list[str]
    answer: str
    verdict: str
    retries: int
    language: str              # preferred answer language ("auto" = match user)
    # Lead capture fields
    mode: str                  # "rag" | "lead_capture"
    contact_form: dict | None  # form metadata from site_registry
    collected: dict            # fields collected so far
    next_field: str | None     # which field to ask for next
    form_submitted: bool

# ─────────────────────────────────────────
# RAG Nodes (unchanged)
# ─────────────────────────────────────────
def retrieve_node(state: RAGState) -> RAGState:
    query = state.get("reformulated_query") or state["question"]
    chunks = retrieve(query, top_k=3)
    return {**state, "chunks": chunks}

_LANG_NAMES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German",
    "ar": "Arabic", "hi": "Hindi", "ur": "Urdu", "pt": "Portuguese",
    "it": "Italian", "zh": "Chinese", "ja": "Japanese",
}

def _language_instruction(state: RAGState) -> str:
    lang = (state.get("language") or "auto").lower()
    if lang == "auto" or lang not in _LANG_NAMES:
        return "Reply in the same language the user used in their question."
    return f"Always reply in {_LANG_NAMES[lang]}."

def _build_generate_prompt(context: str, state: RAGState) -> str:
    return f"""You are a helpful assistant for a company website.
Answer the question using ONLY the context below.
If the context doesn't contain enough information, say "I don't have enough information."
{_language_instruction(state)}

Context:
{context}

Question: {state['question']}

Answer:"""

def _critic_verdict(context: str, answer: str) -> str:
    prompt = f"""You are a strict fact-checker.
Evaluate if the answer is grounded in the context provided.
Reply with ONLY one word: "pass" if grounded, "fail" if not.

Context:
{context}

Answer:
{answer}

Verdict (pass/fail):"""
    response = get_llm().invoke(prompt)
    return "pass" if "pass" in response.content.strip().lower() else "fail"

def _reformulate_query(question: str) -> str:
    prompt = f"""The original question failed to retrieve good context.
Rewrite it as a clearer, more specific search query.
Return ONLY the rewritten query, nothing else.

Original question: {question}
Rewritten query:"""
    return get_llm().invoke(prompt).content.strip()

FALLBACK_ANSWER = (
    "I don't have enough information in the provided documents to answer this accurately."
)

def generate_node(state: RAGState) -> RAGState:
    context = "\n\n".join(state["chunks"])
    response = get_llm().invoke(_build_generate_prompt(context, state))
    return {**state, "answer": response.content}

def critic_node(state: RAGState) -> RAGState:
    context = "\n\n".join(state["chunks"])
    return {**state, "verdict": _critic_verdict(context, state["answer"])}

def reformulate_node(state: RAGState) -> RAGState:
    return {
        **state,
        "reformulated_query": _reformulate_query(state["question"]),
        "retries": state["retries"] + 1,
    }

def fallback_node(state: RAGState) -> RAGState:
    return {**state, "answer": FALLBACK_ANSWER}

def should_retry(state: RAGState) -> str:
    if state["verdict"] == "pass":
        return "end"
    if state["retries"] >= 2:
        return "fallback"
    return "reformulate"

# ─────────────────────────────────────────
# Lead Capture Nodes
# ─────────────────────────────────────────
def lead_capture_node(state: RAGState) -> RAGState:
    """
    Conversational node that collects form fields one by one.
    Uses the question as the user's latest reply.
    """
    form = state.get("contact_form")
    collected = state.get("collected", {})

    # No form detected for this site
    if not form or not form.get("fields"):
        return {
            **state,
            "answer": "I'd love to connect you with the team! You can reach them directly at their contact page.",
            "mode": "rag"
        }

    fields = form["fields"]
    required_fields = [f for f in fields if f["required"]]
    all_fields = fields

    # Store the user's latest reply into the field we just asked for
    next_field = state.get("next_field")
    user_reply = state.get("question", "").strip()

    if next_field and user_reply:
        collected[next_field] = user_reply

    # Find the next unfilled required field
    unfilled = [
        f for f in required_fields
        if f["name"] not in collected
    ]

    # Also check optional fields if all required ones are done
    unfilled_optional = [
        f for f in all_fields
        if f["name"] not in collected and f not in required_fields
    ]

    if unfilled:
        # Ask for the next required field
        field = unfilled[0]
        label = _field_label(field["name"])
        return {
            **state,
            "answer": f"Could you please share your **{label}**?",
            "next_field": field["name"],
            "collected": collected,
            "mode": "lead_capture",
            "form_submitted": False
        }

    elif unfilled_optional and len(collected) < len(required_fields) + 2:
        # Ask for a couple of optional fields too (don't overwhelm)
        field = unfilled_optional[0]
        label = _field_label(field["name"])
        return {
            **state,
            "answer": f"Optional — would you like to add your **{label}**? (or type 'skip')",
            "next_field": field["name"],
            "collected": collected,
            "mode": "lead_capture",
            "form_submitted": False
        }

    else:
        # All fields collected — submit the form
        success = _submit_form(form, collected)
        if success:
            answer = (
                "✅ All done! I've submitted your details to the team. "
                "They'll be in touch with you shortly. "
                "Is there anything else I can help you with?"
            )
        else:
            answer = (
                "I collected your details but had trouble submitting the form automatically. "
                f"Please reach out directly at {form.get('form_url')}."
            )
        return {
            **state,
            "answer": answer,
            "collected": collected,
            "next_field": None,
            "mode": "rag",
            "form_submitted": success,
            "lead_complete": True,
        }

def _field_label(field_name: str) -> str:
    """Convert camelCase field names to readable labels."""
    labels = {
        "firstName": "first name",
        "lastName": "last name",
        "email": "email address",
        "phone": "phone number",
        "phoneCountry": "country code",
        "region": "region / country",
        "companyName": "company name",
        "companyUrl": "company website",
        "subject": "subject / reason for reaching out",
        "message": "message",
    }
    return labels.get(field_name, field_name)

def _submit_form(form: dict, data: dict) -> bool:
    """
    Submits collected data to the contact form endpoint.
    Returns True on success.
    """
    try:
        url = form.get("action") or form.get("form_url")
        method = form.get("method", "post").lower()

        # Handle 'skip' responses for optional fields
        clean_data = {k: v for k, v in data.items() if v.lower() != "skip"}

        with httpx.Client(timeout=10) as client:
            if method == "post":
                res = client.post(url, data=clean_data)
            else:
                res = client.get(url, params=clean_data)

        # 200 or 2xx = success; many forms redirect (3xx) on success too
        return res.status_code < 400

    except Exception as e:
        print(f"Form submission error: {e}")
        return False

# ─────────────────────────────────────────
# Router — decides RAG vs lead capture
# ─────────────────────────────────────────
def entry_router(state: RAGState) -> str:
    """Routes to lead capture if already in that mode, else RAG."""
    if state.get("mode") == "lead_capture":
        return "lead_capture"
    return "retrieve"

def should_retry_or_end(state: RAGState) -> str:
    if state["verdict"] == "pass":
        return "end"
    if state["retries"] >= 2:
        return "fallback"
    return "reformulate"

# ─────────────────────────────────────────
# Build Graph
# ─────────────────────────────────────────
def build_graph():
    graph = StateGraph(RAGState)

    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)
    graph.add_node("critic", critic_node)
    graph.add_node("reformulate", reformulate_node)
    graph.add_node("fallback", fallback_node)
    graph.add_node("lead_capture", lead_capture_node)

    # Entry point branches based on current mode
    graph.set_conditional_entry_point(
        entry_router,
        {"retrieve": "retrieve", "lead_capture": "lead_capture"}
    )

    # RAG flow
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", "critic")
    graph.add_conditional_edges(
        "critic",
        should_retry_or_end,
        {"end": END, "reformulate": "reformulate", "fallback": "fallback"}
    )
    graph.add_edge("reformulate", "retrieve")
    graph.add_edge("fallback", END)

    # Lead capture flow
    graph.add_edge("lead_capture", END)

    return graph.compile()

rag_graph = build_graph()


# ─────────────────────────────────────────
# Streaming (SSE) — preserves the self-critique loop
# ─────────────────────────────────────────
def stream_chat(state: RAGState):
    """
    Generator yielding events for SSE:
      ("token", text)   incremental answer text
      ("reset", None)   discard partial text (a critic retry is starting)
      ("final", result) final state dict (answer, verdict, retries, mode, ...)
    """
    # Lead capture has no LLM streaming — emit the whole reply at once.
    if state.get("mode") == "lead_capture":
        result = lead_capture_node(state)
        yield ("token", result.get("answer", ""))
        yield ("final", result)
        return

    retries = state.get("retries", 0)
    reformulated = ""

    while True:
        query = reformulated or state["question"]
        chunks = retrieve(query, top_k=3)
        context = "\n\n".join(chunks)

        parts: list[str] = []
        for piece in get_llm().stream(_build_generate_prompt(context, state)):
            tok = getattr(piece, "content", "") or ""
            if tok:
                parts.append(tok)
                yield ("token", tok)
        answer = "".join(parts)

        verdict = _critic_verdict(context, answer) if chunks else "fail"

        if verdict == "pass":
            yield ("final", {
                **state, "answer": answer, "verdict": "pass",
                "retries": retries, "chunks": chunks, "mode": "rag",
            })
            return

        if retries >= 2:
            yield ("reset", None)
            yield ("token", FALLBACK_ANSWER)
            yield ("final", {
                **state, "answer": FALLBACK_ANSWER, "verdict": "fail",
                "retries": retries, "chunks": chunks, "mode": "rag",
            })
            return

        retries += 1
        reformulated = _reformulate_query(state["question"])
        yield ("reset", None)