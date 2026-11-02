"""Tool registry — every tool and action must be registered here."""
from .email_tool import EmailTool
from .browser_tool import BrowserTool
from .files_tool import FilesTool
from .payments_tool import PaymentsTool

_TOOLS = {t.name: t for t in [EmailTool(), BrowserTool(), FilesTool(), PaymentsTool()]}

TOOLS_CATALOG = {
    name: {"name": t.name, "description": t.description, "actions": list(t.actions.keys())}
    for name, t in _TOOLS.items()
}


def get_tool(name: str):
    return _TOOLS.get(name)


def list_tools():
    return list(TOOLS_CATALOG.values())
