"""
Database Module
===============
Contains helpers and abstraction methods for interactions with the SQLite database
used to store user study progress, private notes, and custom syllabus mindmap nodes.
State isolation is maintained using key prefixes ('cs:' or 'da:').
"""

import os
import sqlite3
from typing import Dict, List, Any

# Resolve the absolute path to the SQLite file located at the repository root
DATABASE_FILE = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gate_study.db")
)

class DatabaseHelper:
    """
    Utility class for executing SQLite CRUD operations for study tracking and customization.
    """
    
    @staticmethod
    def init_db() -> None:
        """
        Creates SQLite database tables if they do not already exist.
        Initializes schema for:
        - `progress`: Topic completion tracking (completed: 0 or 1).
        - `notes`: User study notes.
        - `custom_nodes`: Mindmap custom child nodes created by the user.
        """
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        
        # Create progress table
        c.execute('''
            CREATE TABLE IF NOT EXISTS progress (
                topic_id TEXT PRIMARY KEY,
                completed INTEGER DEFAULT 0
            )
        ''')
        
        # Create notes table
        c.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                topic_id TEXT PRIMARY KEY,
                content TEXT
            )
        ''')
        
        # Create custom nodes table
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
        """
        Retrieves all progress states, notes, and custom nodes isolated by the active paper stream.
        
        Filters records by the prefix (e.g., 'cs:' or 'da:') to support independent states
        for different syllabus guides, and strips the prefix before returning it to the frontend.
        
        Args:
            paper: The paper stream ('cs' or 'da').
            
        Returns:
            A dictionary containing lists/dicts of progress, notes, and custom nodes.
        """
        prefix = f"{paper}:"
        conn = sqlite3.connect(DATABASE_FILE)
        conn.row_factory = sqlite3.Row  # Enables index-by-name column access
        c = conn.cursor()
        
        # Fetch completion progress matching the paper prefix
        c.execute("SELECT topic_id, completed FROM progress WHERE topic_id LIKE ?", (prefix + "%",))
        progress = {row["topic_id"][len(prefix):]: bool(row["completed"]) for row in c.fetchall()}
        
        # Fetch private study notes matching the paper prefix
        c.execute("SELECT topic_id, content FROM notes WHERE topic_id LIKE ?", (prefix + "%",))
        notes = {row["topic_id"][len(prefix):]: row["content"] for row in c.fetchall()}
        
        # Fetch custom nodes matching the paper prefix
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
    def save_progress(topic_id: str, completed: bool) -> None:
        """
        Saves or updates a topic's completion status.
        
        Args:
            topic_id: The prefix-qualified ID of the topic.
            completed: Boolean state signifying completion status.
        """
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO progress (topic_id, completed) VALUES (?, ?)",
            (topic_id, 1 if completed else 0)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def save_note(topic_id: str, content: str) -> None:
        """
        Saves or updates private study note text for a syllabus topic.
        
        Args:
            topic_id: The prefix-qualified ID of the topic.
            content: The text note content.
        """
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO notes (topic_id, content) VALUES (?, ?)",
            (topic_id, content)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def save_custom_node(node_id: str, parent: str, title: str, url: str) -> None:
        """
        Inserts or updates a user-defined custom mindmap node.
        
        Args:
            node_id: The prefix-qualified ID of the new node.
            parent: The prefix-qualified ID of the parent node.
            title: The title text display for the node.
            url: Optional resource link associated with the node.
        """
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO custom_nodes (id, parent, title, url) VALUES (?, ?, ?, ?)",
            (node_id, parent, title, url)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete_custom_node(node_id: str) -> None:
        """
        Deletes a user-defined custom node by ID.
        
        Args:
            node_id: The prefix-qualified ID of the node to delete.
        """
        conn = sqlite3.connect(DATABASE_FILE)
        c = conn.cursor()
        c.execute("DELETE FROM custom_nodes WHERE id = ?", (node_id,))
        conn.commit()
        conn.close()
