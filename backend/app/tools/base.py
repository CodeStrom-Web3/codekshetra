"""Mock tool base classes. All tools are database-backed and fully isolated —
they can never touch the host filesystem, network, or real accounts."""
import json
from typing import Any, Dict


class ToolRejection(Exception):
    """Raised when a tool call fails schema validation at the gateway boundary."""


class BaseTool:
    name = "base"
    description = ""
    # action -> Pydantic model name registered in schemas (resolved by gateway)
    actions: Dict[str, str] = {}

    def execute(self, action: str, args: dict, db, context: dict) -> dict:  # pragma: no cover
        raise NotImplementedError

    @staticmethod
    def canonicalize(args: dict) -> str:
        """Deterministic canonical JSON used for approval hashing."""
        return json.dumps(args or {}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
