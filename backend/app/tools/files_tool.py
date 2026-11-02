"""Synthetic document store. Logical document names ONLY — host paths rejected."""
import re
from .base import BaseTool
from ..models import MockDocument

_FORBIDDEN_PATTERNS = [r"\.\.", r"^/", r"^[A-Za-z]:", r"\\", r"^~"]


class FilesTool(BaseTool):
    name = "files"
    description = "List, search, read synthetic documents and create mock reports. Logical names only."
    actions = {
        "list": "FilesListArgs",
        "search": "FilesSearchArgs",
        "read": "FilesReadArgs",
        "create_report": "FilesCreateArgs",
    }

    @staticmethod
    def validate_logical_name(name: str) -> bool:
        name = name.strip()
        if not name or len(name) > 200:
            return False
        for pat in _FORBIDDEN_PATTERNS:
            if re.search(pat, name):
                return False
        return bool(re.fullmatch(r"[A-Za-z0-9 _()\-\.]+", name))

    def execute(self, action, args, db, context):
        if action == "list":
            limit = min(int(args.get("limit", 20)), 50)
            rows = db.query(MockDocument).order_by(MockDocument.name).limit(limit).all()
            return {"count": len(rows), "documents": [{"name": r.name, "classification": r.classification,
                    "size": len(r.body or "")} for r in rows]}
        if action == "search":
            q = str(args.get("query", "")).strip()
            like = f"%{q}%"
            rows = db.query(MockDocument).filter(
                (MockDocument.name.ilike(like)) | (MockDocument.body.ilike(like))
            ).limit(20).all()
            return {"count": len(rows), "documents": [{"name": r.name, "classification": r.classification} for r in rows], "query": q}
        if action == "read":
            name = str(args["name"]).strip()
            if not self.validate_logical_name(name):
                return {"found": False, "rejected": True,
                        "error": "Illegal path. Only logical synthetic document names are allowed."}
            row = db.query(MockDocument).filter(MockDocument.name == name).first()
            if not row:
                row = db.query(MockDocument).filter(MockDocument.name.ilike(f"%{name}%")).first()
            if not row:
                return {"found": False, "error": f"document '{name}' not found in synthetic store"}
            return {"found": True, "name": row.name, "body": row.body, "classification": row.classification}
        if action == "create_report":
            name = str(args["name"]).strip()
            if not self.validate_logical_name(name):
                return {"found": False, "rejected": True, "error": "Illegal report name."}
            content = str(args.get("content", ""))
            row = MockDocument(name=name, body=content, classification=args.get("classification", "INTERNAL"))
            db.add(row)
            db.flush()
            return {"created": True, "name": row.name, "classification": row.classification,
                    "size": len(content), "note": "Mock report created in synthetic document store."}
        return {"error": f"unknown files action {action}"}
