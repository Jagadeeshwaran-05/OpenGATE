import os
import re
import sqlite3
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Dict, List, Optional
from src.curriculum import DSAI_SUBJECT_META, CS_SUBJECTS

# Database setup
DATABASE_FILE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gate_study.db"))

def init_db():
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

# Initialize DB on start
init_db()

app = FastAPI(title="OpenGATE Syllabus Explorer Backend")

# Mount static files (resolved relative to src/ directory)
current_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(current_dir, "static")), name="static")

# Jinja2 Templates (resolved relative to src/ directory)
templates = Jinja2Templates(directory=os.path.join(current_dir, "templates"))

# Repository info and paths (resolved relative to project root)
BASE_DIR = os.path.abspath(os.path.join(current_dir, ".."))
DSAI_GATE_DIR = os.path.join(BASE_DIR, "dsai-gate")
CSE_GATE_DIR = os.path.join(BASE_DIR, "cse-gate")

# Syllabus metadata imported from src/curriculum.py

def parse_readme_resources(readme_path: str) -> List[Dict]:
    if not os.path.exists(readme_path):
        return []
    
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    sections = []
    current_section = None
    section_items = []
    
    link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for line in content.splitlines():
        line_stripped = line.strip()
        
        if line_stripped.startswith("##"):
            if current_section and section_items:
                sections.append({
                    "title": current_section,
                    "count": len(section_items),
                    "resources": section_items
                })
            
            header_text = re.sub(r'^#+\s*(?:<a name="[^"]+"></a>)?', '', line_stripped).strip()
            header_lower = header_text.lower()
            
            if "book" in header_lower:
                current_section = "Books"
            elif "course" in header_lower or "nptel" in header_lower or "mooc" in header_lower:
                current_section = "Courses"
            elif "note" in header_lower:
                current_section = "Notes"
            elif "article" in header_lower:
                current_section = "Articles"
            elif "practice" in header_lower or "problem" in header_lower:
                current_section = "Practice"
            else:
                current_section = header_text
                
            section_items = []
            
        elif line_stripped.startswith(("*", "-")) and current_section:
            match = link_pattern.search(line_stripped)
            if match:
                title = match.group(1).strip(' *"`')
                url = match.group(2).strip()
                title = re.sub(r'\*\*|\*|`|"', '', title).strip()
                
                if url.startswith("/"):
                    url = f"https://github.com/Kunaldargan/dsai-gate/blob/main{url}"
                elif not url.startswith("http"):
                    url = f"https://github.com/Kunaldargan/dsai-gate/blob/main/dsai-gate/{url}"
                    
                section_items.append({
                    "title": title[:60] + "..." if len(title) > 63 else title,
                    "url": url
                })
                
    if current_section and section_items:
        sections.append({
            "title": current_section,
            "count": len(section_items),
            "resources": section_items
        })
        
    return sections

def get_curriculum_data_da() -> List[Dict]:
    readme_path = os.path.join(DSAI_GATE_DIR, "README.md")
    if not os.path.exists(readme_path):
        return []
        
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    subject_pattern = re.compile(
        r'<td><h3 id="(?P<id>[^"]+)"><a href="(?P<guide>[^"]+)">\s*(?P<title>[^<]+)</h3></td>\s*<td>(?P<topics_text>.*?)</td>',
        re.DOTALL | re.IGNORECASE
    )
    
    subjects_list = []
    
    for match in subject_pattern.finditer(content):
        sub_id = match.group("id")
        guide = match.group("guide")
        title = match.group("title").strip()
        topics_text = match.group("topics_text")
        
        topics = []
        for line in topics_text.splitlines():
            line_s = line.strip()
            if line_s.startswith(("*", "-")):
                topic = re.sub(r'^[\*\-\s]+', '', line_s).strip()
                topic = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', topic)
                if topic:
                    topics.append(topic)
                    
        meta = DSAI_SUBJECT_META.get(sub_id, {
            "number": "00",
            "short": sub_id[:10],
            "accent": "#635bff",
            "notebook": ""
        })
        
        subject_readme_path = os.path.join(DSAI_GATE_DIR, guide)
        sections = parse_readme_resources(subject_readme_path)
        
        description = f"Core preparation guide for {title}."
        if sub_id == "probability-and-statistics":
            description = "Probability fundamentals, counting methods, and hypothesis testing."
        elif sub_id == "linear-algebra":
            description = "Vector spaces, matrices, eigenvalues, SVD, and quadratic forms."
        elif sub_id == "calculus-and-optimization":
            description = "Single-variable functions, limits, continuity, Taylor series, and optimization."
        elif sub_id == "programming-and-algorithms":
            description = "Python programming, basic data structures, search/sort, and graph traversals."
        elif sub_id == "database-management":
            description = "ER-models, relational algebra, SQL, normal forms, and data warehousing."
        elif sub_id == "machine-learning":
            description = "Supervised regression/classification, MLP, and unsupervised clustering/PCA."
        elif sub_id == "AI":
            description = "Informed/uninformed search, adversarial search, logic, and probabilistic reasoning."
            
        subjects_list.append({
            "id": sub_id,
            "number": meta["number"],
            "short": meta["short"],
            "title": title,
            "description": description,
            "accent": meta["accent"],
            "guide": f"https://github.com/Kunaldargan/dsai-gate/blob/main/dsai-gate/{guide}",
            "notebook": meta["notebook"],
            "topics": topics,
            "sections": sections
        })
        
    return sorted(subjects_list, key=lambda x: x["number"])

def parse_cse_readme_resources(readme_path: str) -> Dict[str, List[Dict]]:
    if not os.path.exists(readme_path):
        return {}
        
    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    subject_resources = {}
    current_subject = None
    section_items = []
    current_section_type = "Resources"
    
    a_tag_pattern = re.compile(r'<a href="(?P<url>[^"]+)"[^>]*>(?P<title>[^<]+)</a>', re.IGNORECASE)
    markdown_link_pattern = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')
    
    for line in content.splitlines():
        line_stripped = line.strip()
        
        # Check if line is a subject header
        if line_stripped.startswith("#") and not line_stripped.startswith("##"):
            if current_subject and section_items:
                if current_subject not in subject_resources:
                    subject_resources[current_subject] = []
                subject_resources[current_subject].append({
                    "title": current_section_type,
                    "count": len(section_items),
                    "resources": section_items
                })
            
            header_text = re.sub(r'^#+\s*', '', line_stripped).strip()
            header_lower = header_text.lower()
            
            if "computation" in header_lower or "toc" in header_lower:
                current_subject = "theory-of-computation"
            elif "operating" in header_lower or "os" in header_lower:
                current_subject = "operating-system"
            elif "c programming" in header_lower:
                current_subject = "programming-and-data-structures"
            elif "data structure" in header_lower:
                current_subject = "programming-and-data-structures"
            elif "digital" in header_lower:
                current_subject = "digital-logic"
            elif "dbms" in header_lower:
                current_subject = "databases"
            elif "compiler" in header_lower:
                current_subject = "compiler-design"
            elif "architecture" in header_lower or "co notes" in header_lower or "coa" in header_lower:
                current_subject = "computer-organization"
            elif "network" in header_lower:
                current_subject = "computer-networks"
            elif "algorithm" in header_lower:
                current_subject = "algorithms"
            else:
                current_subject = None
                
            section_items = []
            current_section_type = "Resources"
            
        elif current_subject:
            if line_stripped.startswith("**") and line_stripped.endswith("**"):
                if section_items:
                    if current_subject not in subject_resources:
                        subject_resources[current_subject] = []
                    subject_resources[current_subject].append({
                        "title": current_section_type,
                        "count": len(section_items),
                        "resources": section_items
                    })
                    section_items = []
                current_section_type = line_stripped.strip("*")
                
            elif line_stripped and (line_stripped[0].isdigit() or line_stripped.startswith(("*", "-"))):
                a_match = a_tag_pattern.search(line_stripped)
                md_match = markdown_link_pattern.search(line_stripped)
                
                title = None
                url = None
                
                if a_match:
                    url = a_match.group("url")
                    title = a_match.group("title").strip()
                elif md_match:
                    title = md_match.group(1).strip()
                    url = md_match.group(2).strip()
                    
                if title and url:
                    title = re.sub(r'\*\*|\*|`|"', '', title).strip()
                    if url.startswith("/"):
                        url = f"https://github.com/baquer/GATE-and-CSE-Resources-for-Students/blob/master{url}"
                    section_items.append({
                        "title": title[:60] + "..." if len(title) > 63 else title,
                        "url": url
                    })
                    
    if current_subject and section_items:
        if current_subject not in subject_resources:
            subject_resources[current_subject] = []
        subject_resources[current_subject].append({
            "title": current_section_type,
            "count": len(section_items),
            "resources": section_items
        })
        
    return subject_resources

def get_curriculum_data_cs() -> List[Dict]:
    readme_path = os.path.join(CSE_GATE_DIR, "README.md")
    resources_by_subject = parse_cse_readme_resources(readme_path)
    
    subjects_list = []
    for sub in CS_SUBJECTS:
        # Clone static subjects structure
        sub_data = dict(sub)
        sub_id = sub_data["id"]
        
        # Populate resources parsed dynamically from cse README
        sub_data["sections"] = resources_by_subject.get(sub_id, [])
        sub_data["guide"] = f"https://github.com/baquer/GATE-and-CSE-Resources-for-Students/blob/master/README.md#{sub_id}"
        
        subjects_list.append(sub_data)
        
    return subjects_list

# Pydantic models for REST APIs
class ProgressSync(BaseModel):
    topic_id: str
    completed: bool

class NoteSync(BaseModel):
    topic_id: str
    content: str

class CustomNode(BaseModel):
    id: str
    parent: str
    title: str
    url: Optional[str] = ""

@app.get("/syllabus/da")
async def get_da_syllabus():
    pdf_path = os.path.join(DSAI_GATE_DIR, "da-syllabus.pdf")
    if os.path.exists(pdf_path):
        return FileResponse(pdf_path, media_type="application/pdf", filename="da-syllabus.pdf")
    raise HTTPException(status_code=404, detail="Syllabus PDF not found")

@app.get("/syllabus/cs")
async def get_cs_syllabus():
    pdf_path = os.path.join(CSE_GATE_DIR, "cs-syllabus.pdf")
    if os.path.exists(pdf_path):
        return FileResponse(pdf_path, media_type="application/pdf", filename="cs-syllabus.pdf")
    raise HTTPException(status_code=404, detail="Syllabus PDF not found")

# Welcome Page Route
@app.get("/", response_class=HTMLResponse)
async def read_welcome(request: Request):
    return templates.TemplateResponse(request=request, name="welcome.html")

# Dynamic Explorer Routes
@app.get("/explorer/{paper}", response_class=HTMLResponse)
async def read_explorer(paper: str, request: Request):
    if paper.lower() == "da":
        subjects = get_curriculum_data_da()
        repository_url = "https://github.com/Kunaldargan/dsai-gate"
        paper_title = "DSAI-GATE · Syllabus Explorer"
        paper_mark = "DA"
    elif paper.lower() == "cs":
        subjects = get_curriculum_data_cs()
        repository_url = "https://github.com/baquer/GATE-and-CSE-Resources-for-Students"
        paper_title = "CSE-GATE · Syllabus Explorer"
        paper_mark = "CS"
    else:
        raise HTTPException(status_code=404, detail="Paper type not found. Use 'da' or 'cs'.")
        
    total_topics = sum(len(sub["topics"]) for sub in subjects)
    total_resources = 0
    for sub in subjects:
        for sec in sub["sections"]:
            total_resources += len(sec["resources"])
            
    if total_resources == 0:
        total_resources = 45 if paper.lower() == "cs" else 56
        
    context = {
        "request": request,
        "paper": paper.lower(),
        "paper_title": paper_title,
        "paper_mark": paper_mark,
        "pages_url": f"http://localhost:8000/explorer/{paper.lower()}",
        "repository_url": repository_url,
        "total_topics": total_topics,
        "total_resources": total_resources,
        "subjects": subjects
    }
    return templates.TemplateResponse(request=request, name="index.html", context=context)

# API routes supporting State Isolation by paper prefix
@app.get("/api/state")
async def get_state(paper: str = "da"):
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

@app.post("/api/progress")
async def save_progress(data: ProgressSync):
    conn = sqlite3.connect(DATABASE_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO progress (topic_id, completed) VALUES (?, ?)",
        (data.topic_id, 1 if data.completed else 0)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/notes")
async def save_notes(data: NoteSync):
    conn = sqlite3.connect(DATABASE_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO notes (topic_id, content) VALUES (?, ?)",
        (data.topic_id, data.content)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/custom-nodes")
async def save_custom_node(data: CustomNode):
    conn = sqlite3.connect(DATABASE_FILE)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO custom_nodes (id, parent, title, url) VALUES (?, ?, ?, ?)",
        (data.id, data.parent, data.title, data.url)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/custom-nodes/{node_id}")
async def delete_custom_node(node_id: str):
    conn = sqlite3.connect(DATABASE_FILE)
    c = conn.cursor()
    c.execute("DELETE FROM custom_nodes WHERE id = ?", (node_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}
