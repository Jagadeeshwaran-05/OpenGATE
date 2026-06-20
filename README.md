# OpenGATE

OpenGATE is an interactive study portal and intelligent learning assistant designed for GATE Computer Science (CS) and Data Science & AI (DA) aspirants. The system combines modern syllabus visualization with agentic retrieval-augmented generation (RAG) to provide a guided preparation path.

## Core Features

- **Syllabus Explorer**: Structured navigation through all syllabus modules for CS and DA papers.
- **Progress Tracking**: Local progress checklists and private study note synchronization.
- **Interactive Memory Map**: Custom drag-and-pan SVG mind maps representing the interconnected syllabus tree.
- **AI Tutor Agent**: A LangGraph-based workflow that retrieves local study guides, parses official syllabus PDFs, and searches the web to provide technical math and engineering explanations.

## Tech Stack

- **Web Server**: FastAPI (Python) and Jinja2 templates.
- **Front End**: Vanilla JavaScript, SVG rendering, and custom CSS with a dark-mode-first glassmorphic visual system.
- **AI & Retrieval**: LangGraph, LangChain, ChromaDB (local vector store), and Sentence-Transformers.
- **Data & Configuration**: DVC (Data Version Control) with DagsHub, and python-dotenv.
- **Database**: SQLite.

## Project Structure

```text
GATE mentor AI/
├── cse-gate/          # CS syllabus source documents (DVC tracked)
├── dsai-gate/         # DA syllabus source documents (DVC tracked)
├── src/               # Application source code
│   ├── agent/         # LangGraph state workflow, tools, and databases
│   ├── static/        # Styling, icons, and client scripts
│   ├── templates/     # HTML pages
│   ├── curriculum.py  # Static syllabus subject definitions
│   └── main.py        # FastAPI server and routing
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

### Configuration

Create a `.env` file in the project root directory and add your API keys:

```env
GEMINI_API_KEY="your_google_gemini_api_key"
OPENROUTER_API_KEY="your_openrouter_api_key"
```

### Running the Application

Start the local development server:

```bash
uv run uvicorn src.main:app --reload
```

Open your browser and navigate to `http://localhost:8000` to access the portal.
