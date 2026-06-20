import os
import re
from typing import Dict, TypedDict, List, Optional
import sympy as sp
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from src.agent.database import VectorCache
from src.agent.tools import solve_equation, web_search_tool

# Define Agent state schema
class AgentState(TypedDict):
    question: str
    paper: str               # 'cs' or 'da'
    chat_history: List[Dict[str, str]]  # [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]
    retrieved_docs: List[Dict]
    math_solution: Optional[str]
    response: str
    steps: List[str]

# Initialize LLM dynamically from environment variables
def get_llm():
    gemini_key = os.getenv("GEMINI_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    
    if openrouter_key:
        base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        return ChatOpenAI(
            model="google/gemini-2.5-flash",
            openai_api_key=openrouter_key,
            openai_api_base=base_url,
            temperature=0.1,
            max_tokens=4096
        )
    elif gemini_key:
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=gemini_key,
            temperature=0.1
        )
    else:
        raise ValueError("Neither GEMINI_API_KEY nor OPENROUTER_API_KEY was found in the environment.")


# Node: Retrieve notes from ChromaDB
def retrieve_notes(state: AgentState) -> Dict:
    db = VectorCache()
    # Search segmented by active paper and general info
    docs = db.search_notes_segmented(state["question"], state["paper"], limit=4)
    return {
        "retrieved_docs": docs,
        "steps": state.get("steps", []) + ["retrieve_notes"]
    }

# Node: Check relevance and route
def check_relevance(state: AgentState) -> str:
    # If no notes retrieved, fall back to web search
    if not state["retrieved_docs"]:
        return "search"
        
    # Standard heuristic check: if we have notes, go to math solving or generation
    # For a high-fidelity agent, we can also check if the query is a greeting or general
    return "solve_math"

# Node: Solve Math problems using SymPy
def solve_math(state: AgentState) -> Dict:
    question = state["question"]
    
    # We ask the LLM to inspect if there is a symbolic math equation to solve.
    # If so, the LLM outputs ONLY a valid SymPy expression. Otherwise, it outputs "NONE".
    llm = get_llm()
    system_prompt = (
        "You are a mathematical parser for SymPy. Analyze the user's question and history.\n"
        "If the question asks to solve a math equation, find a derivative, calculate an integral, "
        "or evaluate a symbolic matrix expression, respond with ONLY the string expression that should be passed to sympy.\n"
        "Use syntax compatible with sp.solve, sp.diff, sp.integrate, etc. Note: sp is already imported.\n"
        "Examples:\n"
        "- Question: 'Solve x^2 - 4 = 0' -> Expression: 'solve(x**2 - 4, x)'\n"
        "- Question: 'What is the derivative of sin(x)*cos(x)?' -> Expression: 'diff(sin(x)*cos(x), x)'\n"
        "- Question: 'Find the integral of 2*x from 0 to 5' -> Expression: 'integrate(2*x, (x, 0, 5))'\n"
        "If no symbolic computation is needed, reply with 'NONE'. Do not include markdown tags, quotes, or formatting."
    )
    
    # Construct history messages
    messages = [SystemMessage(content=system_prompt)]
    for msg in state["chat_history"][-3:]: # context window of last 3 messages
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
    messages.append(HumanMessage(content=f"Question: {question}"))
    
    try:
        res = llm.invoke(messages)
        expr_str = res.content.strip().replace("`", "").replace('"', '').replace("'", "")
        
        if "NONE" in expr_str or not expr_str:
            return {"math_solution": None, "steps": state.get("steps", []) + ["skip_math_solver"]}
            
        print(f"Agent detected math equation. Executing SymPy expression: {expr_str}")
        result = solve_equation(expr_str)
        print(f"SymPy output: {result}")
        return {
            "math_solution": f"SymPy calculated exact result for '{expr_str}': {result}",
            "steps": state.get("steps", []) + ["solve_math"]
        }
    except Exception as e:
        print(f"Math solver node encountered error: {e}")
        return {"math_solution": None, "steps": state.get("steps", []) + ["math_solver_failed"]}

# Node: Fallback web search
def web_search(state: AgentState) -> Dict:
    try:
        query = state["question"]
        print(f"Local database did not yield enough context. Running DuckDuckGo search: {query}")
        search_res = web_search_tool.run(query)
        dummy_doc = {
            "content": f"DuckDuckGo Web Search Results:\n{search_res}",
            "metadata": {"source": "web_search", "file_name": "DuckDuckGo"}
        }
        return {
            "retrieved_docs": state["retrieved_docs"] + [dummy_doc],
            "steps": state.get("steps", []) + ["web_search"]
        }
    except Exception as e:
        print(f"Web search failed: {e}")
        return {"steps": state.get("steps", []) + ["web_search_failed"]}

# Node: Generate explanation
def generate_explanation(state: AgentState) -> Dict:
    llm = get_llm()
    
    # Gather retrieved documents
    contexts = []
    for doc in state["retrieved_docs"]:
        file_info = doc.get("metadata", {}).get("file_name", "Unknown File")
        contexts.append(f"--- Document: {file_info} ---\n{doc['content']}")
    context_str = "\n\n".join(contexts)
    
    math_str = f"\nExact Symbolic Calculation: {state['math_solution']}\n" if state.get("math_solution") else ""
    
    system_prompt = (
        "You are an expert GATE (Graduate Aptitude Test in Engineering) Tutor. "
        "Your task is to provide clear, mathematically precise, and technically sound explanations "
        "for GATE Computer Science (CS) and Data Science & AI (DA) topics.\n\n"
        "Use the retrieved syllabus references and documents below to form your explanation. "
        "If exact symbolic calculations are available, prioritize them. Maintain conversation flow and support active recall.\n\n"
        "Formatting constraints:\n"
        "1. Write mathematical formulas and equations using standard LaTeX formatting:\n"
        "   - Wrap block equations on their own line with $$ double dollar signs (e.g. $$ f(x) = x^2 $$).\n"
        "   - Wrap inline formulas with $ a single dollar sign (e.g. $ O(n \\log n) $).\n"
        "   - Avoid using \\[ \\] or \\( \\) delimiters.\n"
        "2. Do NOT use emojis.\n"
        "3. Format programming code block instructions inside standard markdown fences with language tags (e.g. ```python ... ```).\n\n"
        f"Retrieved Context:\n{context_str}\n{math_str}"
    )
    
    messages = [SystemMessage(content=system_prompt)]
    
    # Add chat history
    for msg in state["chat_history"]:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        else:
            messages.append(AIMessage(content=msg["content"]))
            
    # Add active question
    messages.append(HumanMessage(content=state["question"]))
    
    try:
        response = llm.invoke(messages)
        return {
            "response": response.content,
            "steps": state.get("steps", []) + ["generate_explanation"]
        }
    except Exception as e:
        print(f"LLM generation failed: {e}")
        return {
            "response": f"I encountered an error generating an answer: {e}",
            "steps": state.get("steps", []) + ["generate_explanation_failed"]
        }

# Build LangGraph StateGraph
builder = StateGraph(AgentState)

# Add Nodes
builder.add_node("retrieve_notes", retrieve_notes)
builder.add_node("solve_math", solve_math)
builder.add_node("web_search", web_search)
builder.add_node("generate_explanation", generate_explanation)

# Set Entry Point
builder.set_entry_point("retrieve_notes")

# Add Conditional Edges
builder.add_conditional_edges(
    "retrieve_notes",
    check_relevance,
    {
        "search": "web_search",
        "solve_math": "solve_math"
    }
)

# Connect intermediate nodes
builder.add_edge("web_search", "solve_math")
builder.add_edge("solve_math", "generate_explanation")
builder.add_edge("generate_explanation", END)

# Compile Graph
tutor_agent = builder.compile()
