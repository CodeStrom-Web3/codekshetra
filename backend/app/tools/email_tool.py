"""Synthetic email tool. Reads/writes the mock_emails table only."""
from .base import BaseTool
from ..models import MockEmail


class EmailTool(BaseTool):
    name = "email"
    description = "Read, search, list, draft and send SYNTHETIC emails (fictional mailbox)."
    actions = {
        "list": "EmailListArgs",
        "read": "EmailReadArgs",
        "search": "EmailSearchArgs",
        "draft": "EmailDraftArgs",
        "send": "EmailSendArgs",
    }

    def execute(self, action, args, db, context):
        if action == "list":
            limit = min(int(args.get("limit", 10)), 50)
            rows = db.query(MockEmail).order_by(MockEmail.received_at.desc()).limit(limit).all()
            return {"count": len(rows), "emails": [self._summary(r) for r in rows]}
        if action == "search":
            q = str(args.get("query", "")).strip()
            like = f"%{q}%"
            rows = db.query(MockEmail).filter(
                (MockEmail.subject.ilike(like)) | (MockEmail.body.ilike(like)) | (MockEmail.from_addr.ilike(like))
            ).order_by(MockEmail.received_at.desc()).limit(20).all()
            return {"count": len(rows), "emails": [self._summary(r) for r in rows], "query": q}
        if action == "read":
            row = db.query(MockEmail).filter(MockEmail.id == args["email_id"]).first()
            if not row:
                return {"found": False, "error": f"email {args['email_id']} not found"}
            row.read = True
            db.add(row)
            return {"found": True, "id": row.id, "from": row.from_addr, "to": row.to_addr,
                    "subject": row.subject, "body": row.body, "classification": row.classification,
                    "received_at": row.received_at.isoformat() if row.received_at else None}
        if action == "draft":
            draft = MockEmail(from_addr="target-agent@nexacorp.example", to_addr=args["to"],
                              subject=args.get("subject", "(no subject)"), body=args.get("body", ""),
                              classification=args.get("classification", "INTERNAL"), sent=False, read=True)
            db.add(draft)
            db.flush()
            return {"draft_id": draft.id, "to": draft.to_addr, "subject": draft.subject,
                    "status": "draft_created", "note": "Draft stored as synthetic record; not delivered."}
        if action == "send":
            msg = MockEmail(from_addr="target-agent@nexacorp.example", to_addr=args["to"],
                            subject=args.get("subject", "(no subject)"), body=args.get("body", ""),
                            classification=args.get("classification", "INTERNAL"), sent=True, read=True)
            db.add(msg)
            db.flush()
            return {"sent": True, "sent_id": msg.id, "to": msg.to_addr, "subject": msg.subject,
                    "note": "SIMULATED SEND — synthetic record stored, no network traffic occurred."}
        return {"error": f"unknown email action {action}"}

    @staticmethod
    def _summary(r: MockEmail):
        return {"id": r.id, "from": r.from_addr, "to": r.to_addr, "subject": r.subject,
                "classification": r.classification, "received_at": r.received_at.isoformat() if r.received_at else None,
                "read": r.read}
