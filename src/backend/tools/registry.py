
from typing import Dict, Callable, Any, List

# Define basic tools
async def search_web(query: str) -> str:
    """Mock Web Search Tool (SOTA: In real app, call Google Search API)"""
    return f"[Mock Search Results for: {query}] - Found relevant policies."

async def check_compliance(text: str) -> str:
    """Mock Compliance Checker"""
    if "secret" in text.lower():
        return "ALERT: Compliance Risk Detected (Sensitive Keyword)"
    return "Compliance Check: PASS"

async def lookup_database(key: str) -> str:
    """Mock Database Lookup"""
    return f"DB Result for {key}: {{'status': 'active', 'risk_score': 0.1}}"

# Tool Registry Map
# Maps 'capability_key' from Profile to 'callable_function'
# In SOTA, this might load from a dynamic plugin system.
TOOL_REGISTRY: Dict[str, Callable] = {
    "search_web": search_web,
    "check_compliance": check_compliance,
    "lookup_db": lookup_database,
    "test_tool_a": search_web, # Alias for testing
    "test_tool_b": check_compliance # Alias for testing
}

def get_tools_for_capabilities(capabilities: List[str]) -> List[Callable]:
    """Resolves capability strings to actual functions."""
    tools = []
    for cap in capabilities:
        if cap in TOOL_REGISTRY:
            tools.append(TOOL_REGISTRY[cap])
    return tools
