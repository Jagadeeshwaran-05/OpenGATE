import os
import sqlite3
from typing import Dict, List, Any

DATABASE_FILE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gate_study.db"))

class DatabaseHelper:
    @staticmethod
    def init_db():
        """Initialize SQLite database schemas for user study progress, notes, and custom map nodes."""
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS progress (
                topic_id TEXT PRIMARY KEY,
                completed INTEGER DEFAULT 0
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                topic_id TEXT PRIMARY KEY,
                content TEXT
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS custom_nodes (
                id TEXT PRIMARY KEY,
                parent TEXT,
                title TEXT,
                url TEXT
            )
        ''')
        conn.commit()
        conn.close()

    @staticmethod
    def get_state(paper: str = "da") -> Dict[str, Any]:
        """Fetch progress, notes, and custom nodes isolated by active paper prefix."""
        prefix = f"{paper}:"
        conn = sqlite3.connect(DATABASE_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Fetch progress
        c.execute("SELECT topic_id, completed FROM progress WHERE topic_id LIKE ?", (prefix + "%",))
        progress = {row["topic_id"][len(prefix):]: bool(row["completed"]) for row in c.fetchall()}
        
        # Fetch notes
        c.execute("SELECT topic_id, content FROM notes WHERE topic_id LIKE ?", (prefix + "%",))
        notes = {row["topic_id"][len(prefix):]: row["content"] for row in c.fetchall()}
        
        # Fetch custom nodes
        c.execute("SELECT id, parent, title, url FROM custom_nodes WHERE id LIKE ?", (prefix + "%",))
        custom_nodes = []
        for row in c.fetchall():
            nid = row["id"][len(prefix):]
            parent = row["parent"]
            if parent.startswith(prefix):
                parent = parent[len(prefix):]
            custom_nodes.append({
                "id": nid,
                "parent": parent,
                "title": row["title"],
                "url": row["url"]
            })
            
        conn.close()
        return {
            "progress": progress,
            "notes": notes,
            "custom_nodes": custom_nodes
        }

    @staticmethod
    def save_progress(topic_id: str, completed: bool):
        """Save subject/topic completion state."""
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO progress (topic_id, completed) VALUES (?, ?)",
            (topic_id, 1 if completed else 0)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def save_note(topic_id: str, content: str):
        """Save study note content for a topic."""
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO notes (topic_id, content) VALUES (?, ?)",
            (topic_id, content)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def save_custom_node(node_id: str, parent: str, title: str, url: str):
        """Save a new user-created map node."""
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO custom_nodes (id, parent, title, url) VALUES (?, ?, ?, ?)",
            (node_id, parent, title, url)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete_custom_node(node_id: str):
        """Delete a custom node by ID."""
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute("DELETE FROM custom_nodes WHERE id = ?", (node_id,))
        conn.commit()
        conn.close()
