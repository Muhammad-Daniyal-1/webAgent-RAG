from .embedder import get_collection


def retrieve(query: str, top_k: int = 3) -> list[str]:
    """Return the top-K most similar chunks from the local ChromaDB index."""
    collection = get_collection()
    results = collection.query(
        query_texts=[query],
        n_results=top_k,
    )
    docs = results.get("documents") or []
    return docs[0] if docs else []
