# LangGraph state machine flow for GATE Study Tutor Agent
# Nodes will define step actions, and edges will define logic routing paths.

from typing import Dict, TypedDict, List
from langgraph.graph import StateGraph, END

# Define Agent state schema
class AgentState(TypedDict):
    question: str
    paper: str               # 'cs' or 'da'
    retrieved_docs: List[str]
    response: str
    messages: List[str]

# Define Node Actions
def retrieve_notes(state: AgentState) -> Dict:
    """Retrieve relevant study notes from ChromaDB vector database."""
    return {"retrieved_docs": []}

def generate_explanation(state: AgentState) -> Dict:
    """Generate final math-friendly explanation using the LLM model."""
    return {"response": "Tutor response"}

def web_search(state: AgentState) -> Dict:
    """Fallback search using DuckDuckGo search tool."""
    return {"retrieved_docs": []}

# Define Routing Logic
def check_relevance(state: AgentState) -> str:
    """Check if retrieved notes are sufficient for answering the question."""
    # Returns "generate" or "search"
    return "generate"

# Build Graph
builder = StateGraph(AgentState)
builder.add_node("retrieve_notes", retrieve_notes)
builder.add_node("generate_explanation", generate_explanation)
builder.add_node("web_search", web_search)

builder.set_entry_point("retrieve_notes")
builder.add_conditional_edges(
    "retrieve_notes",
    check_relevance,
    {
        "generate": "generate_explanation",
        "search": "web_search"
    }
)
builder.add_edge("web_search", "generate_explanation")
builder.add_edge("generate_explanation", END)

# Compile graph
tutor_agent = builder.compile()
