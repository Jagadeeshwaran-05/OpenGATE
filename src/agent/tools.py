"""
Agent Tools Module
==================
Contains utility tools for the GATE RAG agent, including a secure symbolic
mathematics equation solver (using SymPy) and a fallback web search engine
(using DuckDuckGo).
"""

import sympy as sp
from duckduckgo_search import DDGS

def solve_equation(expr_str: str) -> str:
    """
    Safely evaluates a SymPy symbolic mathematical expression.
    
    This function creates a restricted namespace containing standard mathematical
    symbols (x, y, z, etc.) and all non-private SymPy functions, then evaluates
    the expression with python's builtins disabled to prevent unsafe code execution.
    
    Args:
        expr_str: A string representing a valid SymPy command (e.g., "diff(sin(x), x)" or "solve(x**2 - 4, x)").
        
    Returns:
        A string representation of the computed mathematical result, or an error message.
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
        
        # Populate all non-private SymPy functions into the evaluation context
        for name in dir(sp):
            if not name.startswith('_'):
                local_dict[name] = getattr(sp, name)
                
        # Evaluate safely without default builtins (disables os, sys, open, import, etc.)
        result = eval(expr_str, {"__builtins__": None}, local_dict)
        return str(result)
    except Exception as e:
        return f"Error solving math equation: {str(e)}"


class WebSearchTool:
    """
    Fallback web search tool designed to fetch context from the web when
    the local vector database lacks relevant resources.
    """
    def run(self, query: str, max_results: int = 5) -> str:
        """
        Executes a text search on DuckDuckGo and formats the results.
        
        Args:
            query: The search query string.
            max_results: The maximum number of search result snippets to retrieve.
            
        Returns:
            A string block compiling search titles, URLs, and text snippets.
        """
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                formatted = []
                for r in results:
                    formatted.append(
                        f"Title: {r.get('title')}\n"
                        f"URL: {r.get('href')}\n"
                        f"Snippet: {r.get('body')}"
                    )
                return "\n\n".join(formatted)
        except Exception as e:
            return f"DuckDuckGo search error: {str(e)}"

# Instantiate a single global web search tool instance
web_search_tool = WebSearchTool()
