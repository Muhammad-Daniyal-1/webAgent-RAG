_client = None
_embedding_fn = None


def _get_client():
    global _client
    if _client is None:
        import chromadb

        _client = chromadb.PersistentClient(path="./chroma_db")
    return _client


def _get_embedding_fn():
    global _embedding_fn
    if _embedding_fn is None:
        from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

        _embedding_fn = SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
    return _embedding_fn


def get_collection(name: str = "documents"):
    return _get_client().get_or_create_collection(
        name=name,
        embedding_function=_get_embedding_fn(),
    )


def clear_collection(name: str = "documents"):
    """Drop and recreate the collection (used before a full re-crawl)."""
    client = _get_client()
    try:
        client.delete_collection(name)
    except Exception:
        pass
    return get_collection(name)


def embed_chunks(chunks: list[str], doc_id: str):
    """Embed and store chunks in ChromaDB."""
    if not chunks:
        return

    collection = get_collection()
    ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"doc_id": doc_id} for _ in chunks]
    collection.upsert(documents=chunks, ids=ids, metadatas=metadatas)
    print(f"Stored {len(chunks)} chunks for doc: {doc_id}")
