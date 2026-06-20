# OpenGATE

OpenGATE is an interactive study portal and intelligent learning assistant designed for GATE Computer Science (CS) and Data Science & AI (DA) aspirants. The system combines modern syllabus visualization with agentic retrieval-augmented generation (RAG) to provide a guided preparation path.

## Core Features

- **Syllabus Explorer**: Structured navigation through all syllabus modules for CS and DA papers.
- **Progress Tracking**: Local progress checklists and private study note synchronization.
- **Interactive Memory Map**: Custom drag-and-pan SVG mind maps representing the interconnected syllabus tree.
- **AI Tutor Agent**: A LangGraph-based workflow that retrieves local study guides, parses official syllabus PDFs, and searches the web to provide technical math and engineering explanations:
  - **Segmented Search**: Restricts retrieved vector contexts to the selected track (`cse-gate` or `dsai-gate`) plus common background info (`general-info`).
  - **Symbolic Math Solver**: Uses SymPy to parse mathematical equations, derivatives, and integrals to calculate exact solutions.
  - **Conversational Memory**: Retains the last 10 turns of dialogue context.
  - **Fallback Search**: Automates DuckDuckGo web searches when local context does not yield relevant materials.
- **Experiment Tracking**: Full logging of query params, conversation histories, retrieved document excerpts, execution steps, and responses to DagsHub via MLflow.

## Tech Stack

- **Web Server**: FastAPI (Python) and Jinja2 templates.
- **Front End**: Vanilla JavaScript, SVG rendering, and custom CSS with a dark-mode-first glassmorphic visual system.
- **AI & Retrieval**: LangGraph, LangChain, ChromaDB (local vector store), and Sentence-Transformers.
- **Data & Configuration**: DVC (Data Version Control) with DagsHub, and python-dotenv.
- **Database**: SQLite (local state) and ChromaDB (vector cache).

## Project Structure

```text
GATE mentor AI/
├── chroma_db/          # SQLite and binary vector files for local search
├── cse-gate/          # CS syllabus source documents (DVC tracked)
├── dsai-gate/         # DA syllabus source documents (DVC tracked)
├── general-info/      # General study strategies and cutoffs (DVC tracked)
├── src/               # Application source code
│   ├── agent/         # LangGraph state workflow, tools, and embeddings
│   │   ├── database.py# Vector database (ChromaDB) queries and filters
│   │   ├── graph.py   # LangGraph node router and state machine compilation
│   │   ├── ingest.py  # Text splitter and embeddings generation loader
│   │   └── tools.py   # SymPy evaluator and DuckDuckGo search tools
│   ├── static/        # Styling, icons, and client scripts
│   ├── templates/     # HTML pages
│   ├── curriculum.py  # Static syllabus subject definitions
│   ├── database.py    # SQLite state helper (progress, notes, custom nodes)
│   ├── parser.py      # Syllabus README and resources parser helper
│   └── main.py        # FastAPI server, schemas, and endpoint routing
├── .env               # Local environment secrets (ignored by Git)
├── pyproject.toml     # Package definitions and dependencies
└── README.md          # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.12 or higher
- The `uv` package manager installed on your system

### Installation

1. Clone this repository to your local machine.
2. Initialize environment dependencies:
   ```bash
   uv sync
   ```

### Vector Database Ingestion

Before starting the tutor, populate the vector database with study guide contents:
```bash
uv run python -m src.agent.ingest
```

### Configuration

Create a `.env` file in the project root directory and add your API keys:

```env
GEMINI_API_KEY="your_google_gemini_api_key"
OPENROUTER_API_KEY="your_openrouter_api_key"
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"

# DagsHub / MLflow credentials
MLFLOW_TRACKING_URI="https://dagshub.com/your_username/OpenGATE.mlflow"
MLFLOW_TRACKING_USERNAME="your_username"
MLFLOW_TRACKING_PASSWORD="your_dagshub_token_or_password"
```

### Running the Application

Start the local development server:

```bash
uv run uvicorn src.main:app --reload
```

Open your browser and navigate to `http://localhost:8000` to access the portal.
