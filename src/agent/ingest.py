import os
import fitz  # PyMuPDF
def split_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """Recursively split text on character boundaries with overlap."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:])
            break
        # Find a clean split point (e.g. newline or space) within the last 200 characters of the window
        split_point = -1
        search_window = text[end - overlap:end]
        for delimiter in ["\n\n", "\n", " "]:
            idx = search_window.rfind(delimiter)
            if idx != -1:
                split_point = end - overlap + idx + len(delimiter)
                break
        if split_point == -1:
            split_point = end
        chunks.append(text[start:split_point])
        start = split_point - overlap
        if start < 0:
            start = 0
        if start >= split_point:  # Prevent infinite loop
            start = split_point
    return chunks

from src.agent.database import VectorCache

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CSE_DIR = os.path.join(BASE_DIR, "cse-gate")
DSAI_DIR = os.path.join(BASE_DIR, "dsai-gate")
GENERAL_DIR = os.path.join(BASE_DIR, "general-info")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from a PDF file page by page."""
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        return text
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""

def extract_text_from_md(md_path: str) -> str:
    """Read content of a markdown/text file."""
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"Error reading markdown {md_path}: {e}")
        return ""

def ingest_data():
    print("Initializing Vector DB and embedding model...")
    db = VectorCache()
    
    # We clear the existing collection to avoid duplicates on re-run
    try:
        print("Clearing existing collection 'gate_notes' to start clean...")
        db.client.delete_collection("gate_notes")
        db.collection = db.client.get_or_create_collection("gate_notes")
    except Exception as e:
        print(f"Note on resetting collection: {e}")


    targets = [
        {"dir": CSE_DIR, "source": "cs"},
        {"dir": DSAI_DIR, "source": "da"},
        {"dir": GENERAL_DIR, "source": "general"}
    ]

    all_texts = []
    all_metadatas = []
    all_ids = []
    chunk_counter = 0

    print("Scanning directories...")
    for target in targets:
        directory = target["dir"]
        source = target["source"]
        
        if not os.path.exists(directory):
            print(f"Directory {directory} does not exist, skipping.")
            continue
            
        print(f"Scanning {directory} (source: {source})...")
        for root, dirs, files in os.walk(directory):
            # Skip hidden folders like .git, .dvc, etc.
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, BASE_DIR)
                file_ext = os.path.splitext(file)[1].lower()

                
                content = ""
                doc_type = ""
                
                if file_ext == ".pdf":
                    content = extract_text_from_pdf(file_path)
                    doc_type = "pdf"
                elif file_ext in [".md", ".txt"]:
                    content = extract_text_from_md(file_path)
                    doc_type = "markdown"
                else:
                    # Skip other extensions
                    continue
                    
                if not content.strip():
                    continue
                    
                chunks = split_text(content)
                print(f" - Parsed {rel_path} ({len(chunks)} chunks)")

                
                for idx, chunk in enumerate(chunks):
                    chunk_counter += 1
                    doc_id = f"{source}_{chunk_counter}_{idx}"
                    
                    metadata = {
                        "source": source,
                        "file_path": rel_path,
                        "file_name": file,
                        "doc_type": doc_type,
                        "chunk_index": idx
                    }
                    
                    all_texts.append(chunk)
                    all_metadatas.append(metadata)
                    all_ids.append(doc_id)

    total_chunks = len(all_texts)
    if total_chunks == 0:
        print("No content found to ingest.")
        return

    print(f"Generating embeddings and storing {total_chunks} chunks in ChromaDB...")
    
    # Process in batches of 64 for efficiency
    batch_size = 64
    for i in range(0, total_chunks, batch_size):
        batch_texts = all_texts[i:i+batch_size]
        batch_metadatas = all_metadatas[i:i+batch_size]
        batch_ids = all_ids[i:i+batch_size]
        
        # Encode batch
        batch_embeddings = db.model.encode(batch_texts).tolist()
        
        # Add to Chroma
        db.collection.add(
            ids=batch_ids,
            embeddings=batch_embeddings,
            documents=batch_texts,
            metadatas=batch_metadatas
        )
        print(f"Progress: {min(i + batch_size, total_chunks)}/{total_chunks} ingested...")

    print("Ingestion complete successfully!")

if __name__ == "__main__":
    ingest_data()
