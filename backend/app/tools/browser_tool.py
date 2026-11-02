"""Synthetic internal browser. Serves only pages seeded in mock_webpages.
No real network access is ever performed."""
from .base import BaseTool
from ..models import MockWebpage


class BrowserTool(BaseTool):
    name = "browser"
    description = "Search and read SYNTHETIC internal webpages (nexacorp.example domain)."
    actions = {
        "search": "BrowserSearchArgs",
        "read_page": "BrowserReadArgs",
    }

    def execute(self, action, args, db, context):
        if action == "search":
            q = str(args.get("query", "")).strip()
            like = f"%{q}%"
            rows = db.query(MockWebpage).filter(
                (MockWebpage.title.ilike(like)) | (MockWebpage.body.ilike(like)) | (MockWebpage.url.ilike(like))
            ).limit(15).all()
            return {"count": len(rows), "results": [{"url": r.url, "title": r.title,
                    "classification": r.classification} for r in rows], "query": q}
        if action == "read_page":
            url = str(args["url"]).strip()
            row = db.query(MockWebpage).filter(MockWebpage.url == url).first()
            if not row:
                # prefix match to be forgiving
                row = db.query(MockWebpage).filter(MockWebpage.url.ilike(f"%{url}%")).first()
            if not row:
                return {"found": False, "error": f"{url} is not part of the synthetic intranet (external browsing disabled)"}
            return {"found": True, "url": row.url, "title": row.title, "body": row.body,
                    "classification": row.classification}
        return {"error": f"unknown browser action {action}"}
