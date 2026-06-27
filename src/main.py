"""
Main Application Entrypoint
===========================
Configures the FastAPI application, mounts static directories, connects templates,
initializes SQLite database states, defines syllabus exploration endpoints, and exposes
rest APIs for study progress, custom nodes, and RAG-based AI Tutor conversation traces.
"""

import os
import time
from typing import Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import mlflow

# Load environment configuration variables (.env)
load_dotenv()

from src.database import DatabaseHelper
from src.parser import get_curriculum_data_da, get_curriculum_data_cs, DSAI_GATE_DIR, CSE_GATE_DIR
from src.agent.graph import tutor_agent, AgentState
from src.agent.test_manager import generate_mock_test, evaluate_mock_test

# Initialize SQLite database schemas on application startup
DatabaseHelper.init_db()


# === PIPELINE TRACE CODE GENERATORS ===

def generate_pipeline_mermaid(steps: List[str]) -> str:
    """
    Translates agent execution history (steps) into a dynamic Mermaid.js flowchart markdown string.
    Identifies executed nodes (highlights in bright blue) vs inactive nodes (dark slate).
    """
    active_color = "#3b82f6"       # Accent blue
    inactive_color = "#1e293b"     # Dark slate
    highlight_stroke = "#60a5fa"   # Light blue border
    standard_stroke = "#334155"    # Dark grey border
    
    retrieve_active = "retrieve_notes" in steps
    search_active = "web_search" in steps
    math_active = "solve_math" in steps
    gen_active = "generate_explanation" in steps or "generate_explanation_failed" in steps
 
    style_retrieve = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if retrieve_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_search = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if search_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_math = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if math_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_gen = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if gen_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"

    link_retrieve_search = "==>|No Context|" if (retrieve_active and search_active) else "-->|No Context|"
    link_retrieve_math = "==>|Context Found|" if (retrieve_active and not search_active) else "-->|Context Found|"
    link_search_math = "==>" if search_active else "-->"
    link_math_gen = "==>" if (math_active or search_active) else "-->"

    steps_list = "\n".join([f"- {s}" for s in steps])

    mermaid_str = f"""# Run Pipeline Execution Trace

Below is the visual pipeline graph showing the execution flow for this run. Nodes highlighted in blue were executed.

```mermaid
graph TD
  startNode([Start]) ==> retrieve_notes
  
  retrieve_notes[1. Retrieve Notes] {link_retrieve_search} web_search
  retrieve_notes {link_retrieve_math} solve_math
  
  web_search[2. Web Search Fallback] {link_search_math} solve_math
  
  solve_math[3. SymPy Math Solver] {link_math_gen} generate_explanation[4. Generate Explanation]
  
  generate_explanation ==> endNode([End])

  style retrieve_notes {style_retrieve}
  style web_search {style_search}
  style solve_math {style_math}
  style generate_explanation {style_gen}
```

### Steps Executed
{steps_list}
"""
    return mermaid_str


def generate_pipeline_html(steps: List[str]) -> str:
    """
    Builds a standalone HTML index page rendering the active execution path using
    embedded Mermaid.js libraries for viewing directly inside tracking dashboards.
    """
    active_color = "#3b82f6"
    inactive_color = "#1e293b"
    highlight_stroke = "#60a5fa"
    standard_stroke = "#334155"
    
    retrieve_active = "retrieve_notes" in steps
    search_active = "web_search" in steps
    math_active = "solve_math" in steps
    gen_active = "generate_explanation" in steps or "generate_explanation_failed" in steps

    style_retrieve = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if retrieve_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_search = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if search_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_math = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if math_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"
    style_gen = f"fill:{active_color},stroke:{highlight_stroke},stroke-width:2px,color:#fff" if gen_active else f"fill:{inactive_color},stroke:{standard_stroke},color:#94a3b8"

    link_retrieve_search = "==>|No Context|" if (retrieve_active and search_active) else "-->|No Context|"
    link_retrieve_math = "==>|Context Found|" if (retrieve_active and not search_active) else "-->|Context Found|"
    link_search_math = "==>" if search_active else "-->"
    link_math_gen = "==>" if (math_active or search_active) else "-->"

    steps_list = "".join([f"<li>{s}</li>" for s in steps])

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GATE Tutor Agent Execution Trace</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'dark',
      themeVariables: {{
        background: '#0f172a',
        primaryColor: '#1e293b',
        primaryTextColor: '#94a3b8',
        lineColor: '#334155'
      }}
    }});
  </script>
  <style>
    body {{
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0b0f17;
      color: #f1f5f9;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }}
    .container {{
      max-width: 800px;
      width: 100%;
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(12px);
      padding: 30px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }}
    h1 {{
      font-size: 22px;
      margin-top: 0;
      margin-bottom: 20px;
      text-align: center;
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .mermaid-box {{
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      display: flex;
      justify-content: center;
    }}
    h3 {{
      font-size: 16px;
      color: #94a3b8;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 8px;
    }}
    ul {{
      padding-left: 20px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
    }}
  </style>
</head>
<body>
  <div class="container">
    <h1>Run Pipeline Execution Trace</h1>
    <p style="text-align: center; color: #94a3b8; font-size: 13px; margin-bottom: 24px;">
      Execution graph for the processed query. Active nodes are highlighted in blue.
    </p>
    
    <div class="mermaid-box">
      <div class="mermaid">
        graph TD
          startNode([Start]) ==> retrieve_notes
          
          retrieve_notes[1. Retrieve Notes] {link_retrieve_search} web_search
          retrieve_notes {link_retrieve_math} solve_math
          
          web_search[2. Web Search Fallback] {link_search_math} solve_math
          
          solve_math[3. SymPy Math Solver] {link_math_gen} generate_explanation[4. Generate Explanation]
          
          generate_explanation ==> endNode([End])

          style retrieve_notes {style_retrieve}
          style web_search {style_search}
          style solve_math {style_math}
          style generate_explanation {style_gen}
      </div>
    </div>
    
    <h3>Steps Executed</h3>
    <ul>
      {steps_list}
    </ul>
  </div>
</body>
</html>
"""
    return html_content


# === FASTAPI CONFIGURATION ===

app = FastAPI(title="OpenGATE Syllabus Explorer Backend")

# Mount static folder holding css, javascript, and fonts
current_dir = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(current_dir, "static")), name="static")

# Connect Jinja2 HTML templates
templates = Jinja2Templates(directory=os.path.join(current_dir, "templates"))


# === ROUTE DEFINITIONS ===

# 1. Welcome Index Page
@app.get("/", response_class=HTMLResponse)
async def read_welcome(request: Request):
    """Renders the landing selection dashboard (DA vs CS path)."""
    return templates.TemplateResponse(request=request, name="welcome.html")


# 2. Dynamic Mindmap Curriculum Explorer Pages
@app.get("/explorer/{paper}", response_class=HTMLResponse)
async def read_explorer(paper: str, request: Request):
    """
    Renders the dynamic interactive syllabus guide explorer.
    Loads curriculum data depending on the path segment ('cs' or 'da').
    """
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
            
    # Hardcode logical fallbacks if README parsing yields no links
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


# 3. PDF Syllabus Reference Downloads
@app.get("/syllabus/da")
async def get_da_syllabus():
    """Serves the official GATE Data Science & AI Syllabus PDF."""
    pdf_path = os.path.join(DSAI_GATE_DIR, "da-syllabus.pdf")
    if os.path.exists(pdf_path):
        return FileResponse(pdf_path, media_type="application/pdf", filename="da-syllabus.pdf")
    raise HTTPException(status_code=404, detail="Syllabus PDF not found")


@app.get("/syllabus/cs")
async def get_cs_syllabus():
    """Serves the official GATE Computer Science & Information Technology Syllabus PDF."""
    pdf_path = os.path.join(CSE_GATE_DIR, "cs-syllabus.pdf")
    if os.path.exists(pdf_path):
        return FileResponse(pdf_path, media_type="application/pdf", filename="cs-syllabus.pdf")
    raise HTTPException(status_code=404, detail="Syllabus PDF not found")


# === PYDANTIC MODEL SCHEMAS ===

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


class TutorChatInput(BaseModel):
    question: str
    paper: str
    subject_id: Optional[str] = None
    topic_id: Optional[str] = None
    chat_history: List[Dict[str, str]] = []


# === SQL DATABASE APIs ===

@app.get("/api/state")
async def get_state(paper: str = "da"):
    """Fetches full state (completion indicators, notes, custom node edits) for active paper."""
    return DatabaseHelper.get_state(paper)


@app.post("/api/progress")
async def save_progress(data: ProgressSync):
    """Persists topic checkbox completion state."""
    DatabaseHelper.save_progress(data.topic_id, data.completed)
    return {"status": "success"}


@app.post("/api/notes")
async def save_notes(data: NoteSync):
    """Persists user notes textarea modifications."""
    DatabaseHelper.save_note(data.topic_id, data.content)
    return {"status": "success"}


@app.post("/api/custom-nodes")
async def save_custom_node(data: CustomNode):
    """Adds a new custom mindmap node branch."""
    DatabaseHelper.save_custom_node(data.id, data.parent, data.title, data.url or "")
    return {"status": "success"}


@app.delete("/api/custom-nodes/{node_id}")
async def delete_custom_node(node_id: str):
    """Removes a user-defined custom mindmap node branch."""
    DatabaseHelper.delete_custom_node(node_id)
    return {"status": "success"}


# === AI TUTOR CHAT API ===

@app.post("/api/tutor/chat")
async def tutor_chat(data: TutorChatInput):
    """
    Processes user questions through the LangGraph RAG Agent.
    Logs run-level parameters, execution graphs (Mermaid trace artifacts), and latency
    metrics directly to MLflow.
    """
    try:
        # Connect to MLflow dashboard (routes to DagsHub experiment board)
        mlflow.set_experiment("GATE_Tutor_Agent")
        
        with mlflow.start_run():
            # Log routing and metadata parameters
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
            
            # Audit response generation latency
            start_time = time.time()
            result = tutor_agent.invoke(inputs)
            latency = time.time() - start_time
            
            # Log run metrics
            mlflow.log_metric("latency_seconds", latency)
            mlflow.log_metric("query_length_chars", float(len(data.question)))
            mlflow.log_metric("response_length_chars", float(len(result["response"])))
            mlflow.log_metric("retrieved_chunks", float(len(result.get("retrieved_docs", []))))
            
            # Generate and upload dynamic trace artifacts
            mermaid_trace = generate_pipeline_mermaid(result.get("steps", []))
            mlflow.log_text(mermaid_trace, "run_pipeline.md")
            
            mermaid_html = generate_pipeline_html(result.get("steps", []))
            mlflow.log_text(mermaid_html, "run_pipeline.html")
            
            mlflow.log_text(data.question, "user_question.txt")
            mlflow.log_text(result["response"], "tutor_response.txt")
            
            # Save helper metadata
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
            
            # Return result payload to browser client
            return {
                "response": result["response"],
                "steps": result.get("steps", []),
                "retrieved_docs": [
                    {
                        "file_name": doc.get("metadata", {}).get("file_name", "unknown"),
                        "file_path": doc.get("metadata", {}).get("file_path", "unknown")
                    }
                    for doc in result.get("retrieved_docs", [])
                    # Avoid showing DDG search dump document info in final sources list
                    if doc.get("metadata", {}).get("source") != "web_search"
                ]
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tutor generation failed: {str(e)}")


# === MOCK TEST APIs ===

class TestStartInput(BaseModel):
    paper: str
    test_type: str  # "general" or "subject"
    subjects: Optional[List[str]] = []


class TestEvaluateInput(BaseModel):
    questions: List[Dict]
    answers: Dict[str, str]


@app.post("/api/tutor/test/start")
async def start_mock_test(data: TestStartInput):
    """Generates a new 20-question mock test."""
    try:
        questions = generate_mock_test(data.paper, data.test_type, data.subjects)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mock test generation failed: {str(e)}")


@app.post("/api/tutor/test/evaluate")
async def evaluate_test_submission(data: TestEvaluateInput):
    """Grades and evaluates a mock test submission."""
    try:
        report = evaluate_mock_test(data.questions, data.answers)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mock test evaluation failed: {str(e)}")
