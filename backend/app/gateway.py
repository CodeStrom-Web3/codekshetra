"""Tool Gateway — the ONLY path to mock tools.

Pipeline: Schema validation → Permission check → Guardian (policy engine) →
Decision → Approval binding (SHA-256) → Mock tool execution → Audit log.
"""
import json, hashlib, uuid
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from pydantic import ValidationError

from .tools import get_tool
from .gateway_schemas import ARG_SCHEMAS
from .guardian import Guardian, make_policy_lookup
from .models import ToolCall, GuardianDecision, ApprovalRequest, AuditLog


def canonical_json(args: dict) -> str:
    return json.dumps(args or {}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class GatewayResult:
    def __init__(self, **kw):
        self.__dict__.update(kw)

    def to_dict(self):
        return dict(self.__dict__)


class ToolGateway:
    """Stateless per-call pipeline. `protected=False` = baseline mode (Guardian
    bypassed but sandboxing + audit retained)."""

    def __init__(self, db: Session):
        self.db = db
        self.guardian = Guardian(make_policy_lookup(db))

    # ───────────────────────────────────────────────────────── public API
    def call(self, *, tool: str, action: str, args: dict, agent: str = "target-agent",
             protected: bool = True, attempt_id: Optional[int] = None,
             simulation_id: Optional[int] = None, source_context: str = "user",
             notes: str = "", prior_actions: Optional[List[dict]] = None,
             approval_token: Optional[dict] = None) -> dict:
        correlation_id = str(uuid.uuid4())
        verdict = {
            "correlation_id": correlation_id, "tool": tool, "action": action,
            "agent": agent, "args": args, "protected": protected,
        }

        # ── 1. Tool & action resolution + schema validation
        tool_obj = get_tool(tool)
        if tool_obj is None or action not in tool_obj.actions:
            return self._reject(verdict, attempt_id, simulation_id,
                                f"Unknown tool/action: {tool}.{action}", "SCHEMA")

        schema_name = tool_obj.actions[action]
        schema_cls = ARG_SCHEMAS.get(schema_name)
        try:
            validated = schema_cls(**(args or {}))
            clean_args = validated.model_dump(exclude_none=True)
        except ValidationError as e:
            detail = "; ".join(f"{'.'.join(str(x) for x in err['loc'])}: {err['msg']}"
                               for err in e.errors()[:5])
            return self._reject(verdict, attempt_id, simulation_id,
                                f"Schema validation failed: {detail}", "SCHEMA")

        canonical = canonical_json(clean_args)
        args_hash = sha256_hex(canonical)
        verdict["args"] = clean_args
        verdict["args_hash"] = args_hash

        # ── 2. Guardian (or baseline bypass)
        prior = [{"tool": p.get("tool"), "action": p.get("action")} for p in (prior_actions or [])]
        if protected:
            evaluation = self.guardian.evaluate(tool=tool, action=action, args=clean_args,
                                                agent=agent, source_context=source_context,
                                                notes=notes, prior_actions=prior)
            # SANITIZE_AND_RECHECK: strip instruction-like lines, re-evaluate once
            if evaluation["decision"] == "SANITIZE_AND_RECHECK":
                evaluation = self._sanitize_and_recheck(tool, action, clean_args, agent,
                                                        source_context, notes, prior, evaluation)
                clean_args = evaluation.pop("_sanitized_args", clean_args)
                canonical = canonical_json(clean_args)
                args_hash = sha256_hex(canonical)
                verdict["args"] = clean_args
                verdict["args_hash"] = args_hash
        else:
            evaluation = self._baseline_evaluation(tool, action)

        decision = evaluation["decision"]
        verdict.update({
            "decision": decision,
            "risk_score": evaluation["risk_score"],
            "severity": evaluation["severity"],
            "rationale": evaluation["rationale"],
            "triggered_rules": evaluation["triggered_rules"],
            "risk_breakdown": evaluation["risk_breakdown"],
            "base_risk": evaluation["base_risk"],
            "evidence": evaluation["evidence"],
        })

        # ── 3. Approval handling
        if decision == "REQUIRE_APPROVAL":
            if approval_token:
                ok, reason = self._verify_approval(approval_token, agent, tool, action,
                                                   clean_args, args_hash)
                if ok:
                    decision = "ALLOW"
                    verdict["decision"] = "ALLOW"
                    verdict["rationale"] = f"Approval {approval_token.get('id')} revalidated OK (hash + expiry + permissions). {evaluation['rationale']}"
                    verdict["approved_via"] = approval_token.get("id")
                else:
                    verdict["decision"] = "BLOCK"
                    verdict["rationale"] = f"APPROVAL REJECTED AT GATEWAY: {reason}"
                    decision = "BLOCK"
                    verdict["approval_invalid"] = True
            else:
                approval = self._create_approval_request(
                    agent=agent, tool=tool, action=action, args=clean_args,
                    canonical=canonical, args_hash=args_hash,
                    risk=evaluation["risk_score"],
                    policies=[r["code"] for r in evaluation["triggered_rules"]],
                    evidence=evaluation["evidence"],
                    attempt_id=attempt_id, simulation_id=simulation_id,
                    correlation_id=correlation_id)
                verdict["approval_id"] = approval.id
                verdict["executed"] = False
                verdict["result"] = {"status": "awaiting_approval", "approval_id": approval.id}
                self._persist(verdict, attempt_id, simulation_id, executed=False,
                              result_summary="Awaiting human approval")
                return verdict

        if decision == "BLOCK":
            verdict["executed"] = False
            verdict["result"] = {"status": "blocked"}
            self._persist(verdict, attempt_id, simulation_id, executed=False,
                          result_summary="Blocked by Guardian" if protected else "Blocked (baseline schema)")
            return verdict

        # ── 4. Execute mock tool
        try:
            result = tool_obj.execute(action, clean_args, self.db,
                                      {"actor": agent, "correlation_id": correlation_id})
        except Exception as e:  # tool failure must never crash the pipeline
            result = {"error": f"mock tool failure: {type(e).__name__}: {e}"}
        verdict["executed"] = True
        verdict["result"] = result
        self._persist(verdict, attempt_id, simulation_id, executed=True,
                      result_summary=self._summarize_result(tool, action, result))
        return verdict

    # ───────────────────────────────────────────────────────── approval binding
    def _create_approval_request(self, *, agent, tool, action, args, canonical, args_hash,
                                 risk, policies, evidence, attempt_id, simulation_id,
                                 correlation_id) -> ApprovalRequest:
        approval = ApprovalRequest(
            attempt_id=attempt_id, simulation_id=simulation_id,
            agent_name=agent, tool=tool, action=action, args=args,
            args_canonical=canonical, args_hash=args_hash,
            risk_score=risk, policies=policies, evidence=evidence,
            status="PENDING", correlation_id=correlation_id,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
        self.db.add(approval)
        self.db.flush()
        return approval

    def _verify_approval(self, token: dict, agent: str, tool: str, action: str,
                         args: dict, args_hash: str):
        """Revalidate binding: agent+tool+action+args hash + expiry + status."""
        approval_id = token.get("id")
        row = self.db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
        if not row:
            return False, "approval request not found"
        if row.status != "APPROVED":
            return False, f"approval status is {row.status}, expected APPROVED"
        if row.expires_at and datetime.utcnow() > row.expires_at:
            row.status = "EXPIRED"
            self.db.add(row)
            return False, "approval expired"
        if row.agent_name != agent:
            return False, f"agent mismatch (approval bound to {row.agent_name})"
        if row.tool != tool or row.action != action:
            return False, f"tool/action mismatch (approval bound to {row.tool}.{row.action})"
        canonical_now = canonical_json(args)
        if sha256_hex(canonical_now) != row.args_hash:
            return False, "ARGUMENT HASH MISMATCH — arguments changed after approval (tampering)"
        return True, "ok"

    # ───────────────────────────────────────────────────────── persistence
    def _persist(self, verdict, attempt_id, simulation_id, executed, result_summary):
        tc = ToolCall(
            attempt_id=attempt_id, simulation_id=simulation_id,
            agent_name=verdict["agent"], tool=verdict["tool"], action=verdict["action"],
            args=verdict.get("args"), args_hash=verdict.get("args_hash", ""),
            decision=verdict.get("decision"),
            decision_source="GUARDIAN" if verdict.get("protected") else "BASELINE",
            executed=executed, sanitized=verdict.get("_sanitized", False),
            result_summary=result_summary,
            base_risk=verdict.get("base_risk", 0),
            risk_breakdown=verdict.get("risk_breakdown", {}),
            risk_score=verdict.get("risk_score", 0),
        )
        self.db.add(tc)
        self.db.flush()
        verdict["tool_call_id"] = tc.id

        gd = GuardianDecision(
            tool_call_id=tc.id, attempt_id=attempt_id,
            decision=verdict.get("decision"),
            risk_score=verdict.get("risk_score", 0),
            severity=verdict.get("severity", "INFO"),
            triggered_rules=verdict.get("triggered_rules", []),
            rationale=verdict.get("rationale", ""),
            evidence=verdict.get("evidence", {}),
        )
        self.db.add(gd)

        self.db.add(AuditLog(
            actor=verdict["agent"], actor_role="AGENT",
            action=f"tool.{verdict['tool']}.{verdict['action']}",
            resource=(verdict.get("args") or {}).get("invoice")
                     or (verdict.get("args") or {}).get("name")
                     or (verdict.get("args") or {}).get("url")
                     or (verdict.get("args") or {}).get("to") or "",
            result=verdict.get("decision"),
            correlation_id=verdict.get("correlation_id"),
            evidence={"risk": verdict.get("risk_score"), "executed": executed,
                      "rules": [r["code"] for r in verdict.get("triggered_rules", [])]},
        ))

    def _reject(self, verdict, attempt_id, simulation_id, reason, source):
        verdict.update({"decision": "BLOCK", "risk_score": 100, "severity": "CRITICAL",
                        "rationale": reason, "triggered_rules": [
                            {"code": f"{source[:3]}-REJ", "name": "Gateway schema rejection",
                             "severity": "CRITICAL", "detail": reason, "weight": 100}],
                        "risk_breakdown": {"schema_rejection": 100}, "base_risk": 0,
                        "evidence": {"error": reason}, "executed": False,
                        "result": {"status": "schema_rejected"}})
        self._persist(verdict, attempt_id, simulation_id, executed=False, result_summary=reason)
        return verdict

    def _baseline_evaluation(self, tool, action):
        """Baseline mode: no Guardian. Only schema validation still applies
        (sandboxing is non-negotiable). Recorded as decision=ALLOW unless schema failed."""
        return {
            "decision": "ALLOW", "risk_score": 0, "severity": "INFO",
            "triggered_rules": [],
            "rationale": "BASELINE MODE — Guardian bypassed (pre-deployment posture). Sandboxing, schema validation and audit retained.",
            "evidence": {"mode": "BASELINE", "tool": tool, "action": action},
            "base_risk": 0,
            "risk_breakdown": {"baseline_bypass": True},
        }

    def _sanitize_and_recheck(self, tool, action, clean_args, agent, source_context, notes,
                              prior, original_eval):
        """Strip instruction-like lines from content args, then re-run evaluate."""
        from .guardian import scan_injection
        import copy, re

        def scrub(text):
            if not isinstance(text, str):
                return text
            kept = []
            for line in text.splitlines():
                if not scan_injection(line):
                    kept.append(line)
            cleaned = "\n".join(kept).strip()
            return re.sub(r"(?i)(ignore|disregard|forget)\s.*", "[REDACTED-BY-GUARDIAN]", cleaned)

        sanitized = {}
        for k, v in clean_args.items():
            if k in ("body", "content", "subject", "description", "query"):
                sanitized[k] = scrub(v)
            else:
                sanitized[k] = v
        recheck = self.guardian.evaluate(tool=tool, action=action, args=sanitized, agent=agent,
                                         source_context=source_context, notes="", prior_actions=prior)
        recheck["_sanitize_note"] = original_eval["rationale"]
        recheck["_sanitized"] = sanitized != clean_args
        recheck["_sanitized_args"] = sanitized
        if recheck["decision"] == "ALLOW":
            recheck["rationale"] = "SANITIZE_AND_RECHECK: instruction-like content stripped; re-evaluation clean. " + recheck["rationale"]
        return recheck

    @staticmethod
    def _summarize_result(tool, action, result):
        if not isinstance(result, dict):
            return str(result)[:300]
        if "error" in result:
            return f"error: {result['error']}"[:300]
        if tool == "email" and action == "send":
            return f"simulated send to {result.get('to')} (id {result.get('sent_id')})"
        if tool == "email" and action == "draft":
            return f"draft created (id {result.get('draft_id')})"
        if tool == "email":
            return f"{result.get('count', result.get('found', ''))} item(s) returned"
        if tool == "payments" and action == "execute":
            return f"simulated payment {result.get('reference', '')} €{result.get('amount', 0):,.0f}"
        if tool == "payments":
            return f"invoice {result.get('invoice', 'list')} → {str(result)[:120]}"
        if tool == "files":
            return f"{result.get('count', result.get('found', result.get('created', '')))} — {result.get('name', '')}"[:200]
        return json.dumps(result)[:200]


def gateway_call(db: Session, **kwargs) -> dict:
    """Convenience wrapper used by simulations, tests and routes."""
    return ToolGateway(db).call(**kwargs)
