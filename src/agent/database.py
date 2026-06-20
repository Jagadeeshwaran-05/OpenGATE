# Vector database (ChromaDB) connection and utility functions
import os
import chromadb
from sentence_transformers import SentenceTransformer

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "chroma_db"))

class VectorCache:
    def __init__(self):
        # Initialize local ChromaDB client
        self.client = chromadb.PersistentClient(path=DB_DIR)
        # Initialize local embeddings model
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        self.collection = self.client.get_or_create_collection("gate_notes")

    def add_notes(self, document_id: str, text: str, metadata: dict):
        """Add study notes content with local embeddings to ChromaDB."""
        embeddings = self.model.encode(text).tolist()
        self.collection.add(
            ids=[document_id],
            embeddings=[embeddings],
            documents=[text],
            metadatas=[metadata]
        )

    def search_notes(self, query: str, limit: int = 3) -> list:
        """Perform similarity search for query against vector database."""
        query_embeddings = self.model.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[query_embeddings],
            n_results=limit
        )
        return results.get("documents", [[]])[0]

    def search_notes_segmented(self, query: str, paper: str, limit: int = 4) -> list:
        """Perform similarity search, isolating sources by paper ('cs' or 'da') and 'general'."""
        query_embeddings = self.model.encode(query).tolist()
        # Segment filter: source must be either the active paper or 'general'
        where_filter = {"source": {"$in": [paper, "general"]}}
        results = self.collection.query(
            query_embeddings=[query_embeddings],
            n_results=limit,
            where=where_filter
        )
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        
        docs_with_meta = []
        for doc, meta in zip(documents, metadatas):
            docs_with_meta.append({
                "content": doc,
                "metadata": meta
            })
        return docs_with_meta

