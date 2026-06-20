import os
from typing import Dict, List, Optional
from dotenv import load_dotenv
load_dotenv()

import mlflow
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from src.database import DatabaseHelper
from src.parser import get_curriculum_data_da, get_curriculum_data_cs, DSAI_GATE_DIR, CSE_GATE_DIR
from src.agent.graph import tutor_agent, AgentState

# Initialize SQLite database schema
DatabaseHelper.init_db()

app = FastAPI(title="OpenGATE Syllabus Explorer Backend")

# Mount static files (resolved relative to src/ directory)
current_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(current_dir, "static")), name="static")

# Jinja2 Templates (resolved relative to src/ directory)
templates = Jinja2Templates(directory=os.path.join(current_dir, "templates"))


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


# Official Syllabus Download Routes
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


# API routes supporting State Isolation by paper prefix
@app.get("/api/state")
async def get_state(paper: str = "da"):
    return DatabaseHelper.get_state(paper)


@app.post("/api/progress")
async def save_progress(data: ProgressSync):
    DatabaseHelper.save_progress(data.topic_id, data.completed)
    return {"status": "success"}


@app.post("/api/notes")
async def save_notes(data: NoteSync):
    DatabaseHelper.save_note(data.topic_id, data.content)
    return {"status": "success"}


@app.post("/api/custom-nodes")
async def save_custom_node(data: CustomNode):
    DatabaseHelper.save_custom_node(data.id, data.parent, data.title, data.url or "")
    return {"status": "success"}


@app.delete("/api/custom-nodes/{node_id}")
async def delete_custom_node(node_id: str):
    DatabaseHelper.delete_custom_node(node_id)
    return {"status": "success"}


# RAG Tutor Chat API
class TutorChatInput(BaseModel):
    question: str
    paper: str
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    chat_history: List[Dict[str, str]] = []


@app.post("/api/tutor/chat")
async def tutor_chat(data: TutorChatInput):
    try:
        # Initialize MLflow experiment targeting DagsHub
        mlflow.set_experiment("GATE_Tutor_Agent")
        
        with mlflow.start_run():
            # Log params
            mlflow.log_params({
                "paper": data.paper,
                "subject_id": data.subject_id or "general",
                "topic_id": data.topic_id or "general",
                "history_length": len(data.chat_history)
            })
            mlflow.log_param("question_preview", data.question[:200])
            
            inputs: AgentState = {
                "question": data.question,
                "paper": data.paper,
                "chat_history": data.chat_history,
                "retrieved_docs": [],
                "math_solution": None,
                "response": "",
                "steps": []
            }
            
            # Execute LangGraph RAG Agent
            result = tutor_agent.invoke(inputs)
            
            # Log artifacts & trace details
            mlflow.log_text(data.question, "user_question.txt")
            mlflow.log_text(result["response"], "tutor_response.txt")
            mlflow.log_param("agent_steps", ",".join(result.get("steps", [])))
            
            retrieved_names = [
                doc.get("metadata", {}).get("file_name", "unknown")
                for doc in result.get("retrieved_docs", [])
            ]
            mlflow.log_param("retrieved_docs_count", len(retrieved_names))
            mlflow.log_param("retrieved_docs_list", ",".join(retrieved_names[:5]))
            
            context_excerpt = "\n\n".join([
                f"File: {doc.get('metadata', {}).get('file_path', 'unknown')}\n{doc['content']}"
                for doc in result.get("retrieved_docs", [])
            ])
            mlflow.log_text(context_excerpt, "retrieved_context.txt")
            
            return {
                "response": result["response"],
                "steps": result.get("steps", []),
                "retrieved_docs": [
                    {
                        "file_name": doc.get("metadata", {}).get("file_name", "unknown"),
                        "file_path": doc.get("metadata", {}).get("file_path", "unknown")
                    }
                    for doc in result.get("retrieved_docs", [])
                    if doc.get("metadata", {}).get("source") != "web_search"
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tutor generation failed: {str(e)}")
