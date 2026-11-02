"""AGENTSHIELD — FastAPI application (REST + WebSocket)."""
import asyncio, threading, uuid
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, SessionLocal
from .models import (User, Agent, Scenario, Simulation, SimulationRound, AttackAttempt, ToolCall,
                     GuardianDecision, Policy, PolicyChange, ApprovalRequest, AuditLog,
                     ReportRecord, MockEmail, MockWebpage, MockDocument, MockPayment, Setting)
from .security import (hash_password, verify_password, create_access_token,
                       get_current_user, require_roles, ROLE_PERMISSIONS)
from .seed import seed_all
from .gateway import ToolGateway
from .simulations import run_simulation, set_control, clear_control
from .analytics import (compute_metrics, category_breakdown, decision_distribution,
                        rounds_breakdown, severity_breakdown, policy_hit_counts, risk_trend)
from .reports import generate_reports
from .ws import manager, make_broadcast

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AGENTSHIELD API", version="1.0.0",
              description="Autonomous AI Agent Security Testing & Defence Platform — fictional data, isolated mock tools.")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# seed on startup
with SessionLocal() as db:
    seed_all(db)

LIMIT = 100


def paginate(q, page: int, page_size: int):
    total = q.count()
    return q.offset((page - 1) * page_size).limit(page_size).all(), total


def audit(db, actor, role, action, resource="", result="SUCCESS", evidence=None, corr=None):
    db.add(AuditLog(actor=actor, actor_role=role, action=action, resource=resource,
                    result=result, correlation_id=corr or str(uuid.uuid4()), evidence=evidence or {}))


# ═══════════════════════════ AUTH ═══════════════════════════
class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@app.post("/api/auth/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username.lower().strip()).first()
    if not user or not verify_password(form.password, user.hashed_password):
        audit(db, form.username, "ANON", "auth.login", form.username, "FAILURE")
        db.commit()
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(403, "Account disabled")
    user.last_login = datetime.utcnow()
    db.add(user)
    audit(db, user.email, user.role, "auth.login", user.email, "SUCCESS")
    db.commit()
    token = create_access_token({"sub": user.email, "role": user.role})
    return LoginResponse(access_token=token,
                         user={"email": user.email, "full_name": user.full_name, "role": user.role,
                               "must_change_password": user.must_change_password,
                               "permissions": ROLE_PERMISSIONS.get(user.role, [])})


@app.get("/api/auth/me")
def me(current: User = Depends(get_current_user)):
    return {"email": current.email, "full_name": current.full_name, "role": current.role,
            "must_change_password": current.must_change_password,
            "permissions": ROLE_PERMISSIONS.get(current.role, [])}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


@app.post("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db),
                    current: User = Depends(get_current_user)):
    if not verify_password(req.current_password, current.hashed_password):
        raise HTTPException(400, "Current password incorrect")
    current.hashed_password = hash_password(req.new_password)
    current.must_change_password = False
    db.add(current)
    audit(db, current.email, current.role, "auth.password_change", current.email, "SUCCESS")
    db.commit()
    return {"status": "password_changed"}


# ═══════════════════════════ DASHBOARD ═══════════════════════════
@app.get("/api/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    metrics = compute_metrics(db)
    latest_sim = db.query(Simulation).order_by(desc(Simulation.id)).first()
    return {
        "metrics": metrics,
        "counts": {
            "simulations": db.query(Simulation).count(),
            "scenarios": db.query(Scenario).count(),
            "tool_calls": db.query(ToolCall).count(),
            "blocked": db.query(ToolCall).filter(ToolCall.decision == "BLOCK").count(),
            "pending_approvals": db.query(ApprovalRequest).filter(ApprovalRequest.status == "PENDING").count(),
            "audit_events": db.query(AuditLog).count(),
            "agents": db.query(Agent).count(),
        },
        "latest_simulation": _sim_dict(latest_sim) if latest_sim else None,
        "recent_attempts": [_attempt_dict(a) for a in db.query(AttackAttempt).order_by(desc(AttackAttempt.id)).limit(8).all()],
        "risk_trend": risk_trend(db, 30),
        "decisions": decision_distribution(db),
        "policy_hits": policy_hit_counts(db, 6),
    }


# ═══════════════════════════ AGENTS ═══════════════════════════
@app.get("/api/agents")
def list_agents(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    agents = db.query(Agent).all()
    return [{"id": a.id, "name": a.name, "kind": a.kind, "description": a.description,
             "version": a.version, "status": a.status, "permissions": a.permissions,
             "config": a.config, "created_at": a.created_at.isoformat()} for a in agents]


# ═══════════════════════════ SCENARIOS ═══════════════════════════
@app.get("/api/scenarios")
def list_scenarios(category: Optional[str] = None, severity: Optional[str] = None,
                   vector: Optional[str] = None, is_attack: Optional[bool] = None,
                   search: Optional[str] = None,
                   db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(Scenario)
    if category:
        q = q.filter(Scenario.category == category)
    if severity:
        q = q.filter(Scenario.severity == severity)
    if vector:
        q = q.filter(Scenario.vector == vector)
    if is_attack is not None:
        q = q.filter(Scenario.is_attack == is_attack)
    if search:
        like = f"%{search}%"
        q = q.filter((Scenario.name.ilike(like)) | (Scenario.code.ilike(like)) | (Scenario.payload.ilike(like)))
    rows = q.order_by(Scenario.code).all()
    return [_scenario_dict(s) for s in rows]


@app.get("/api/scenarios/{code}")
def get_scenario(code: str, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    s = db.query(Scenario).filter(Scenario.code == code).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    return _scenario_dict(s)


# ═══════════════════════════ SIMULATIONS ═══════════════════════════
class SimulationCreate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    mode: str = Field(pattern="^(BASELINE|PROTECTED|COMPARATIVE)$")
    scenario_codes: List[str] = Field(min_length=1)
    rounds: int = Field(default=3, ge=1, le=5)


@app.post("/api/simulations")
def create_simulation(req: SimulationCreate, db: Session = Depends(get_db),
                      current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    codes = [c.upper() for c in req.scenario_codes]
    found = {s.code for s in db.query(Scenario).filter(Scenario.code.in_(codes)).all()}
    missing = [c for c in codes if c not in found]
    if missing:
        raise HTTPException(400, f"Unknown scenario codes: {', '.join(missing)}")
    sim = Simulation(name=req.name, mode=req.mode, scenario_codes=codes, rounds=req.rounds,
                     status="PENDING", created_by=current.email,
                     total_attempts=len(codes) * req.rounds)
    db.add(sim)
    db.flush()
    audit(db, current.email, current.role, "simulation.create", f"simulation#{sim.id}", "SUCCESS",
          {"mode": sim.mode, "scenarios": len(codes), "rounds": req.rounds})
    db.commit()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    broadcast = make_broadcast(loop) if loop.is_running() else (lambda event, payload: None)

    def worker():
        worker_db = SessionLocal()
        try:
            sim_obj = worker_db.query(Simulation).filter(Simulation.id == sim.id).first()
            run_simulation(worker_db, sim_obj, broadcast)
        except Exception as e:
            try:
                sim_obj = worker_db.query(Simulation).filter(Simulation.id == sim.id).first()
                sim_obj.status = "FAILED"
                worker_db.add(sim_obj)
                worker_db.commit()
            except Exception:
                pass
            broadcast("simulation.failed", {"simulation_id": sim.id, "error": str(e)})
        finally:
            clear_control(sim.id)
            worker_db.close()

    threading.Thread(target=worker, daemon=True).start()
    return _sim_dict(sim)


@app.get("/api/simulations")
def list_simulations(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=LIMIT),
                     status: Optional[str] = None,
                     db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(Simulation).order_by(desc(Simulation.id))
    if status:
        q = q.filter(Simulation.status == status)
    rows, total = paginate(q, page, page_size)
    return {"items": [_sim_dict(s) for s in rows], "total": total, "page": page, "page_size": page_size}


@app.get("/api/simulations/{sim_id}")
def get_simulation(sim_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
    if not sim:
        raise HTTPException(404, "Simulation not found")
    attempts = db.query(AttackAttempt).filter(AttackAttempt.simulation_id == sim_id).order_by(AttackAttempt.id).all()
    rounds = db.query(SimulationRound).filter(SimulationRound.simulation_id == sim_id).order_by(SimulationRound.round_number).all()
    return {**_sim_dict(sim),
            "attempts": [_attempt_dict(a) for a in attempts],
            "rounds": [{"round": r.round_number, "label": r.label, "mode": r.mode,
                        "adaptive": r.adaptive,
                        "started_at": r.started_at.isoformat() if r.started_at else None,
                        "finished_at": r.finished_at.isoformat() if r.finished_at else None} for r in rounds],
            "metrics": compute_metrics(db, sim_id)}


@app.post("/api/simulations/{sim_id}/{action}")
def control_simulation(sim_id: int, action: str, db: Session = Depends(get_db),
                       current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    if action not in ("pause", "resume", "stop", "restart"):
        raise HTTPException(400, "action must be pause|resume|stop|restart")
    sim = db.query(Simulation).filter(Simulation.id == sim_id).first()
    if not sim:
        raise HTTPException(404, "Simulation not found")

    if action == "restart":
        # fresh simulation with same config
        new_sim = Simulation(name=sim.name + " (restart)", mode=sim.mode,
                             scenario_codes=sim.scenario_codes, rounds=sim.rounds,
                             status="PENDING", created_by=current.email,
                             total_attempts=len(sim.scenario_codes or []) * sim.rounds)
        db.add(new_sim)
        db.flush()
        audit(db, current.email, current.role, "simulation.restart", f"simulation#{sim.id}→#{new_sim.id}", "SUCCESS")
        db.commit()
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        broadcast = make_broadcast(loop) if loop.is_running() else (lambda event, payload: None)

        def worker():
            wdb = SessionLocal()
            try:
                obj = wdb.query(Simulation).filter(Simulation.id == new_sim.id).first()
                run_simulation(wdb, obj, broadcast)
            except Exception as e:
                broadcast("simulation.failed", {"simulation_id": new_sim.id, "error": str(e)})
            finally:
                clear_control(new_sim.id)
                wdb.close()

        threading.Thread(target=worker, daemon=True).start()
        return _sim_dict(new_sim)

    set_control(sim_id, action)
    if action == "stop":
        sim.status = "STOPPING"
    elif action == "pause":
        sim.status = "PAUSED"
    elif action == "resume":
        sim.status = "RUNNING"
    db.add(sim)
    audit(db, current.email, current.role, f"simulation.{action}", f"simulation#{sim_id}", "SUCCESS")
    db.commit()
    return _sim_dict(sim)


@app.get("/api/simulations/{sim_id}/attempts")
def simulation_attempts(sim_id: int, page: int = Query(1, ge=1), page_size: int = Query(50, le=200),
                        db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(AttackAttempt).filter(AttackAttempt.simulation_id == sim_id).order_by(AttackAttempt.id)
    rows, total = paginate(q, page, page_size)
    return {"items": [_attempt_dict(a) for a in rows], "total": total}


# ═══════════════════════════ ATTEMPT DETAIL ═══════════════════════════
@app.get("/api/attempts/{attempt_id}")
def get_attempt(attempt_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    a = db.query(AttackAttempt).filter(AttackAttempt.id == attempt_id).first()
    if not a:
        raise HTTPException(404, "Attempt not found")
    calls = db.query(ToolCall).filter(ToolCall.attempt_id == attempt_id).order_by(ToolCall.id).all()
    detail = []
    for c in calls:
        dec = db.query(GuardianDecision).filter(GuardianDecision.tool_call_id == c.id).first()
        detail.append({**_toolcall_dict(c),
                       "guardian": {"decision": dec.decision, "risk": dec.risk_score,
                                    "severity": dec.severity, "triggered_rules": dec.triggered_rules,
                                    "rationale": dec.rationale, "evidence": dec.evidence} if dec else None})
    return {**_attempt_dict(a), "payload": a.payload, "tool_calls": detail}


# ═══════════════════════════ TOOL GATEWAY (interactive) ═══════════════════════════
class GatewayCall(BaseModel):
    tool: str
    action: str
    args: dict = {}
    agent: str = "target-agent"
    protected: bool = True
    source_context: str = "user"
    notes: str = ""


@app.post("/api/gateway/call")
def gateway_call_endpoint(req: GatewayCall, db: Session = Depends(get_db),
                          current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    result = ToolGateway(db).call(tool=req.tool, action=req.action, args=req.args,
                                  agent=req.agent, protected=req.protected,
                                  source_context=req.source_context, notes=req.notes)
    audit(db, current.email, current.role, "gateway.call", f"{req.tool}.{req.action}",
          result["decision"], {"risk": result.get("risk_score")})
    db.commit()
    return result


# ═══════════════════════════ GUARDIAN / DECISIONS ═══════════════════════════
@app.get("/api/guardian/feed")
def guardian_feed(limit: int = Query(30, le=100), decision: Optional[str] = None,
                  db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(GuardianDecision).order_by(desc(GuardianDecision.id)).limit(limit)
    rows = q.all()
    if decision:
        rows = [r for r in rows if r.decision == decision]
    out = []
    for d in rows:
        tc = db.query(ToolCall).filter(ToolCall.id == d.tool_call_id).first()
        out.append({"id": d.id, "tool_call_id": d.tool_call_id,
                    "tool": tc.tool if tc else None, "action": tc.action if tc else None,
                    "args": tc.args if tc else None,
                    "decision": d.decision, "risk_score": d.risk_score, "severity": d.severity,
                    "triggered_rules": d.triggered_rules, "rationale": d.rationale,
                    "evidence": d.evidence, "created_at": d.created_at.isoformat()})
    return out


# ═══════════════════════════ POLICIES ═══════════════════════════
@app.get("/api/policies")
def list_policies(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(Policy).order_by(Policy.code).all()
    return [{"id": p.id, "code": p.code, "name": p.name, "description": p.description,
             "category": p.category, "severity": p.severity, "enabled": p.enabled,
             "mandatory": p.mandatory, "config": p.config,
             "updated_by": p.updated_by, "updated_at": p.updated_at.isoformat()} for p in rows]


class PolicyUpdate(BaseModel):
    enabled: Optional[bool] = None
    config: Optional[dict] = None


@app.post("/api/policies/{code}")
def update_policy(code: str, req: PolicyUpdate, db: Session = Depends(get_db),
                  current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    p = db.query(Policy).filter(Policy.code == code).first()
    if not p:
        raise HTTPException(404, "Policy not found")
    if req.enabled is not None:
        if p.mandatory and req.enabled is False:
            raise HTTPException(400, "Mandatory policy cannot be disabled. Mandatory controls override configuration.")
        old = str(p.enabled)
        p.enabled = req.enabled
        db.add(PolicyChange(policy_code=p.code, actor=current.email, action="toggle",
                            old_value=old, new_value=str(req.enabled)))
    if req.config is not None:
        old = str(p.config)
        merged = dict(p.config or {})
        merged.update(req.config)
        p.config = merged
        db.add(PolicyChange(policy_code=p.code, actor=current.email, action="config",
                            old_value=old, new_value=str(merged)))
    p.updated_by = current.email
    p.updated_at = datetime.utcnow()
    db.add(p)
    audit(db, current.email, current.role, "policy.update", p.code, "SUCCESS",
          {"enabled": p.enabled, "config": p.config})
    db.commit()
    return {"id": p.id, "code": p.code, "enabled": p.enabled, "config": p.config,
            "mandatory": p.mandatory, "updated_by": p.updated_by}


@app.get("/api/policies/{code}/history")
def policy_history(code: str, db: Session = Depends(get_db),
                   current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    rows = db.query(PolicyChange).filter(PolicyChange.policy_code == code).order_by(desc(PolicyChange.id)).limit(50).all()
    return [{"id": r.id, "actor": r.actor, "action": r.action, "old_value": r.old_value,
             "new_value": r.new_value, "created_at": r.created_at.isoformat()} for r in rows]


class PolicyTest(BaseModel):
    tool: str
    action: str
    args: dict = {}
    source_context: str = "user"
    notes: str = ""


@app.post("/api/policies/test")
def test_policy(req: PolicyTest, db: Session = Depends(get_db),
                current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    """Safe dry-run: evaluate a synthetic call against the Guardian without executing the tool."""
    from .guardian import Guardian, make_policy_lookup
    g = Guardian(make_policy_lookup(db))
    result = g.evaluate(tool=req.tool, action=req.action, args=req.args, agent="target-agent",
                        source_context=req.source_context, notes=req.notes, prior_actions=[])
    audit(db, current.email, current.role, "policy.test", f"{req.tool}.{req.action}",
          result["decision"], {"risk": result["risk_score"]})
    db.commit()
    return result


# ═══════════════════════════ APPROVALS ═══════════════════════════
@app.get("/api/approvals")
def list_approvals(status: Optional[str] = None, page: int = Query(1, ge=1),
                   page_size: int = Query(30, le=100),
                   db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    q = db.query(ApprovalRequest).order_by(desc(ApprovalRequest.id))
    if status:
        q = q.filter(ApprovalRequest.status == status.upper())
    rows, total = paginate(q, page, page_size)
    return {"items": [_approval_dict(a) for a in rows], "total": total, "page": page}


def _approval_verdict(db, approval: ApprovalRequest, approve: bool, reviewer: User):
    # expire stale pendings
    if approval.expires_at and datetime.utcnow() > approval.expires_at and approval.status == "PENDING":
        approval.status = "EXPIRED"
    if approval.status != "PENDING":
        return {"status": approval.status, "error": f"Approval is {approval.status}, no longer actionable"}
    approval.status = "APPROVED" if approve else "REJECTED"
    approval.reviewed_by = reviewer.email
    approval.reviewed_at = datetime.utcnow()
    db.add(approval)
    db.flush()
    audit(db, reviewer.email, reviewer.role,
          "approval.approve" if approve else "approval.reject",
          f"approval#{approval.id}", approval.status,
          {"tool": approval.tool, "action": approval.action, "hash": approval.args_hash})
    # If approved → execute the bound call through the gateway (revalidates hash)
    executed_result = None
    if approve:
        gateway = ToolGateway(db)
        executed_result = gateway.call(tool=approval.tool, action=approval.action,
                                       args=approval.args, agent=approval.agent_name,
                                       protected=True, attempt_id=approval.attempt_id,
                                       simulation_id=approval.simulation_id,
                                       approval_token={"id": approval.id})
        if executed_result.get("executed"):
            approval.status = "EXECUTED"
            db.add(approval)
    db.commit()
    return {"status": approval.status, "approval": _approval_dict(approval),
            "execution": executed_result}


@app.post("/api/approvals/{approval_id}/approve")
def approve_request(approval_id: int, db: Session = Depends(get_db),
                    current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST", "FINANCE_USER"))):
    a = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not a:
        raise HTTPException(404, "Approval not found")
    if a.tool == "payments" and current.role == "SECURITY_ANALYST":
        raise HTTPException(403, "Payment approvals require ADMIN or FINANCE_USER")
    return _approval_verdict(db, a, True, current)


@app.post("/api/approvals/{approval_id}/reject")
def reject_request(approval_id: int, db: Session = Depends(get_db),
                   current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST", "FINANCE_USER"))):
    a = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not a:
        raise HTTPException(404, "Approval not found")
    return _approval_verdict(db, a, False, current)


# ═══════════════════════════ AUDIT ═══════════════════════════
@app.get("/api/audit")
def list_audit(page: int = Query(1, ge=1), page_size: int = Query(50, le=200),
               action: Optional[str] = None, actor: Optional[str] = None,
               db: Session = Depends(get_db),
               current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    q = db.query(AuditLog).order_by(desc(AuditLog.id))
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if actor:
        q = q.filter(AuditLog.actor.ilike(f"%{actor}%"))
    rows, total = paginate(q, page, page_size)
    return {"items": [{"id": r.id, "actor": r.actor, "actor_role": r.actor_role,
                       "action": r.action, "resource": r.resource, "result": r.result,
                       "correlation_id": r.correlation_id, "evidence": r.evidence,
                       "created_at": r.created_at.isoformat()} for r in rows],
            "total": total, "page": page}


# ═══════════════════════════ ANALYTICS ═══════════════════════════
@app.get("/api/analytics")
def analytics(simulation_id: Optional[int] = None,
              db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return {
        "metrics": compute_metrics(db, simulation_id),
        "categories": category_breakdown(db, simulation_id),
        "decisions": decision_distribution(db, simulation_id),
        "rounds": rounds_breakdown(db, simulation_id),
        "severity": severity_breakdown(db, simulation_id),
        "policy_hits": policy_hit_counts(db),
        "risk_trend": risk_trend(db, 40),
    }


# ═══════════════════════════ REPORTS ═══════════════════════════
class ReportCreate(BaseModel):
    simulation_id: Optional[int] = None


@app.post("/api/reports")
def create_report(req: ReportCreate, db: Session = Depends(get_db),
                  current: User = Depends(require_roles("ADMIN", "SECURITY_ANALYST"))):
    rec = generate_reports(db, req.simulation_id, current.email)
    return _report_dict(rec)


@app.get("/api/reports")
def list_reports(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(ReportRecord).order_by(desc(ReportRecord.id)).limit(50).all()
    return [_report_dict(r) for r in rows]


@app.get("/api/reports/{report_id}/{fmt}")
def download_report(report_id: int, fmt: str, db: Session = Depends(get_db),
                    current: User = Depends(get_current_user)):
    rec = db.query(ReportRecord).filter(ReportRecord.id == report_id).first()
    if not rec:
        raise HTTPException(404, "Report not found")
    path = {"pdf": rec.pdf_path, "csv": rec.csv_path, "json": rec.json_path}.get(fmt)
    if not path or not __import__("os").path.exists(path):
        raise HTTPException(404, f"{fmt} artifact not found")
    media = {"pdf": "application/pdf", "csv": "text/csv", "json": "application/json"}[fmt]
    return FileResponse(path, media_type=media, filename=f"{rec.name}.{fmt}")


# ═══════════════════════════ TOOLS DATA (sandbox browsers) ═══════════════════════════
@app.get("/api/mock/emails")
def mock_emails(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(MockEmail).order_by(desc(MockEmail.id)).limit(30).all()
    return [{"id": r.id, "from": r.from_addr, "to": r.to_addr, "subject": r.subject,
             "classification": r.classification, "malicious": r.is_malicious, "sent": r.sent,
             "received_at": r.received_at.isoformat() if r.received_at else None} for r in rows]


@app.get("/api/mock/webpages")
def mock_webpages(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(MockWebpage).order_by(MockWebpage.url).all()
    return [{"id": r.id, "url": r.url, "title": r.title, "classification": r.classification,
             "malicious": r.is_malicious} for r in rows]


@app.get("/api/mock/documents")
def mock_documents(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(MockDocument).order_by(MockDocument.name).all()
    return [{"id": r.id, "name": r.name, "classification": r.classification,
             "canary": r.is_canary_holder, "size": len(r.body or "")} for r in rows]


@app.get("/api/mock/payments")
def mock_payments(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(MockPayment).order_by(MockPayment.id).all()
    return [{"id": r.id, "invoice": r.invoice, "vendor": r.vendor, "amount": r.amount,
             "currency": r.currency, "description": r.description, "classification": r.classification,
             "status": r.status} for r in rows]


# ═══════════════════════════ SETTINGS ═══════════════════════════
@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    rows = db.query(Setting).all()
    return {r.key: r.value for r in rows}


class SettingsUpdate(BaseModel):
    key: str
    value: str = Field(max_length=200)


@app.post("/api/settings")
def update_settings(req: SettingsUpdate, db: Session = Depends(get_db),
                    current: User = Depends(require_roles("ADMIN"))):
    row = db.query(Setting).filter(Setting.key == req.key).first()
    if row:
        row.value = req.value
    else:
        row = Setting(key=req.key, value=req.value)
    db.add(row)
    audit(db, current.email, current.role, "settings.update", req.key, "SUCCESS")
    db.commit()
    return {"key": req.key, "value": req.value}


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    from .tools import list_tools
    ollama = False
    try:
        import httpx
        r = httpx.get("http://localhost:11434/api/tags", timeout=0.6)
        ollama = r.status_code == 200
    except Exception:
        ollama = False
    return {"status": "ok", "version": "1.0.0",
            "database": "sqlite", "records": {
                "users": db.query(User).count(), "scenarios": db.query(Scenario).count(),
                "simulations": db.query(Simulation).count(),
                "tool_calls": db.query(ToolCall).count()},
            "tools": list_tools(),
            "ai_mode": "ollama+fallback" if ollama else "deterministic-fallback",
            "ollama_available": ollama}


# ═══════════════════════════ WEBSOCKET ═══════════════════════════
@app.websocket("/ws/events")
async def ws_events(ws: WebSocket):
    await manager.connect(ws)
    try:
        await ws.send_json({"type": "connected", "ts": datetime.utcnow().isoformat() + "Z",
                            "message": "AGENTSHIELD event stream — live gateway, Guardian and simulation events"})
        while True:
            # keepalive + allow client pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# ═══════════════════════════ SERIALIZERS ═══════════════════════════
def _sim_dict(s: Simulation):
    return {"id": s.id, "name": s.name, "mode": s.mode, "status": s.status,
            "scenario_codes": s.scenario_codes, "rounds": s.rounds,
            "total_attempts": s.total_attempts, "completed_attempts": s.completed_attempts,
            "attacks_blocked": s.attacks_blocked, "attacks_succeeded": s.attacks_succeeded,
            "benign_completed": s.benign_completed, "benign_blocked": s.benign_blocked,
            "created_by": s.created_by,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "finished_at": s.finished_at.isoformat() if s.finished_at else None}


def _scenario_dict(s: Scenario):
    return {"code": s.code, "name": s.name, "category": s.category, "severity": s.severity,
            "vector": s.vector, "payload": s.payload, "description": s.description,
            "expected_decision": s.expected_decision, "source_ref": s.source_ref,
            "is_attack": s.is_attack, "steps": len(s.steps or []), "harm_tools": s.harm_tools}


def _attempt_dict(a: AttackAttempt):
    return {"id": a.id, "simulation_id": a.simulation_id, "round": a.round_number,
            "round_mode": a.round_mode, "adaptive": a.adaptive,
            "scenario": a.scenario_code, "scenario_name": a.scenario_name,
            "category": a.category, "severity": a.severity, "is_attack": a.is_attack,
            "expected": a.expected_decision, "final_decision": a.final_decision,
            "risk": a.risk_score, "attack_succeeded": a.attack_succeeded,
            "outcome": a.outcome, "duration_ms": a.duration_ms,
            "correlation_id": a.correlation_id,
            "started_at": a.started_at.isoformat() if a.started_at else None}


def _toolcall_dict(c: ToolCall):
    return {"id": c.id, "tool": c.tool, "action": c.action, "args": c.args,
            "args_hash": c.args_hash, "decision": c.decision,
            "decision_source": c.decision_source, "executed": c.executed,
            "sanitized": c.sanitized, "result_summary": c.result_summary,
            "base_risk": c.base_risk, "risk_breakdown": c.risk_breakdown,
            "risk": c.risk_score, "created_at": c.created_at.isoformat() if c.created_at else None}


def _approval_dict(a: ApprovalRequest):
    return {"id": a.id, "attempt_id": a.attempt_id, "simulation_id": a.simulation_id,
            "agent": a.agent_name, "tool": a.tool, "action": a.action, "args": a.args,
            "args_hash": a.args_hash, "risk": a.risk_score, "policies": a.policies,
            "evidence": a.evidence, "status": a.status,
            "requested_at": a.requested_at.isoformat() if a.requested_at else None,
            "expires_at": a.expires_at.isoformat() if a.expires_at else None,
            "reviewed_by": a.reviewed_by,
            "reviewed_at": a.reviewed_at.isoformat() if a.reviewed_at else None,
            "correlation_id": a.correlation_id}


def _report_dict(r: ReportRecord):
    return {"id": r.id, "name": r.name, "scope": r.scope, "simulation_id": r.simulation_id,
            "generated_by": r.generated_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "downloads": {"pdf": f"/api/reports/{r.id}/pdf",
                          "csv": f"/api/reports/{r.id}/csv",
                          "json": f"/api/reports/{r.id}/json"}}
