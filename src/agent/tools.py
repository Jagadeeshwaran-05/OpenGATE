# Agent tools (math and web search helpers)
import sympy as sp
from langchain_community.tools import DuckDuckGoSearchRun

# 1. Math solver tool using Sympy
def solve_equation(expr_str: str) -> str:
    """Solve symbolic mathematics equations.
    Example: expr_str='solve(x**2 - 4, x)'
    """
    try:
        # Convert string expression to sympy syntax and evaluate safely
        # Note: In production, ensure inputs are sanitized
        result = eval(f"sp.{expr_str}")
        return str(result)
    except Exception as e:
        return f"Error solving math equation: {str(e)}"

# 2. Web search tool using DuckDuckGo
web_search_tool = DuckDuckGoSearchRun()
