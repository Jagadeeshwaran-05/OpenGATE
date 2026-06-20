# Agent tools (math and web search helpers)
import sympy as sp
from duckduckgo_search import DDGS

# 1. Math solver tool using Sympy
def solve_equation(expr_str: str) -> str:
    """Solve symbolic mathematics equations.
    Example: expr_str='solve(x**2 - 4, x)'
    """
    try:
        # Define standard variables as SymPy symbols
        x, y, z, t = sp.symbols('x y z t')
        a, b, c, d = sp.symbols('a b c d')
        n, k, m = sp.symbols('n k m', integer=True)
        
        # Build local dictionary with symbols and SymPy namespace
        local_dict = {
            'x': x, 'y': y, 'z': z, 't': t,
            'a': a, 'b': b, 'c': c, 'd': d,
            'n': n, 'k': k, 'm': m,
            'sp': sp
        }
        
        # Populate all non-private SymPy functions into evaluation context
        for name in dir(sp):
            if not name.startswith('_'):
                local_dict[name] = getattr(sp, name)
                
        # Evaluate safely without default builtins (like os, sys, etc.)
        result = eval(expr_str, {"__builtins__": None}, local_dict)
        return str(result)
    except Exception as e:
        return f"Error solving math equation: {str(e)}"


# 2. Web search tool using DuckDuckGo
class WebSearchTool:
    def run(self, query: str, max_results: int = 5) -> str:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                formatted = []
                for r in results:
                    formatted.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}")
                return "\n\n".join(formatted)
        except Exception as e:
            return f"DuckDuckGo search error: {str(e)}"

web_search_tool = WebSearchTool()

