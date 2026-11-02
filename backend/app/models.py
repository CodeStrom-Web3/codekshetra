"""AGENTSHIELD database models (SQLAlchemy / SQLite).

All synthetic, fictional data. No real systems are connected.
"""
from datetime import datetime
from sqlalchemy import (Column, Integer, String, Boolean, Float, DateTime, Text,
                        ForeignKey, Index, JSON)
from .database import Base


def now() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    role = Column(String(30), nullable=False, default="GENERAL_USER")  # ADMIN, SECURITY_ANALYST, FINANCE_USER, GENERAL_USER
    hashed_password = Column(String(300), nullable=False)
    must_change_password = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now)


class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True, nullable=False)
    kind = Column(String(30), nullable=False)  # RED_TEAM, TARGET, GUARDIAN
    description = Column(Text, default="")
    version = Column(String(40), default="1.0.0")
    status = Column(String(30), default="ONLINE")
    permissions = Column(JSON, default=list)  # list of "tool.action" strings
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)


class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(60), nullable=False)
    severity = Column(String(20), nullable=False)  # INFO, LOW, MEDIUM, HIGH, CRITICAL
    vector = Column(String(30), nullable=False)    # direct, email, webpage, document, benign
    payload = Column(Text, default="")
    description = Column(Text, default="")
    expected_decision = Column(String(40), nullable=False)
    source_ref = Column(String(120), default="")   # e.g. email subject / webpage url / doc name
    steps = Column(JSON, default=list)             # deterministic steps the target proposes
    is_attack = Column(Boolean, default=True)
    harm_tools = Column(JSON, default=list)        # tools whose execution = attack succeeded
    created_at = Column(DateTime, default=now)


class Simulation(Base):
    __tablename__ = "simulations"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    mode = Column(String(20), nullable=False)  # BASELINE, PROTECTED, COMPARATIVE
    status = Column(String(20), default="PENDING")  # PENDING, RUNNING, PAUSED, COMPLETED, STOPPED, FAILED
    scenario_codes = Column(JSON, default=list)
    rounds = Column(Integer, default=3)
    total_attempts = Column(Integer, default=0)
    completed_attempts = Column(Integer, default=0)
    attacks_blocked = Column(Integer, default=0)
    attacks_succeeded = Column(Integer, default=0)
    benign_completed = Column(Integer, default=0)
    benign_blocked = Column(Integer, default=0)
    created_by = Column(String(200), default="system")
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now)


class SimulationRound(Base):
    __tablename__ = "simulation_rounds"
    id = Column(Integer, primary_key=True)
    simulation_id = Column(Integer, ForeignKey("simulations.id", ondelete="CASCADE"), index=True)
    round_number = Column(Integer, nullable=False)
    label = Column(String(120), default="")
    mode = Column(String(20), nullable=False)  # BASELINE / PROTECTED (adaptive)
    adaptive = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)


class AttackAttempt(Base):
    __tablename__ = "attack_attempts"
    id = Column(Integer, primary_key=True)
    simulation_id = Column(Integer, ForeignKey("simulations.id", ondelete="CASCADE"), index=True)
    round_number = Column(Integer, default=1)
    round_mode = Column(String(20), default="PROTECTED")
    adaptive = Column(Boolean, default=False)
    scenario_code = Column(String(20), index=True)
    scenario_name = Column(String(200), default="")
    category = Column(String(60), index=True)
    is_attack = Column(Boolean, default=True)
    severity = Column(String(20), default="MEDIUM")
    expected_decision = Column(String(40), default="")
    final_decision = Column(String(40), default="ALLOW")
    risk_score = Column(Integer, default=0)
    attack_succeeded = Column(Boolean, default=False)
    outcome = Column(String(60), default="")  # PREVENTED / SUCCEEDED / COMPLETED / BLOCKED_FP
    duration_ms = Column(Integer, default=0)
    correlation_id = Column(String(64), index=True)
    payload = Column(Text, default="")
    started_at = Column(DateTime, default=now)
    finished_at = Column(DateTime, nullable=True)


class ToolCall(Base):
    __tablename__ = "tool_calls"
    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, ForeignKey("attack_attempts.id", ondelete="CASCADE"), index=True)
    simulation_id = Column(Integer, index=True, nullable=True)
    agent_name = Column(String(120), default="target-agent")
    tool = Column(String(60), index=True)
    action = Column(String(60))
    args = Column(JSON, default=dict)
    args_hash = Column(String(64), default="")
    decision = Column(String(40), default="ALLOW")  # ALLOW, BLOCK, REQUIRE_APPROVAL, SANITIZE_AND_RECHECK
    decision_source = Column(String(30), default="GUARDIAN")  # GUARDIAN / BASELINE
    executed = Column(Boolean, default=False)
    sanitized = Column(Boolean, default=False)
    result_summary = Column(Text, default="")
    base_risk = Column(Integer, default=0)
    risk_breakdown = Column(JSON, default=dict)
    risk_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=now, index=True)


class GuardianDecision(Base):
    __tablename__ = "guardian_decisions"
    id = Column(Integer, primary_key=True)
    tool_call_id = Column(Integer, ForeignKey("tool_calls.id", ondelete="CASCADE"), index=True)
    attempt_id = Column(Integer, index=True, nullable=True)
    decision = Column(String(40), nullable=False)
    risk_score = Column(Integer, default=0)
    severity = Column(String(20), default="LOW")
    triggered_rules = Column(JSON, default=list)  # [{code,name,severity,detail}]
    rationale = Column(Text, default="")
    evidence = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now, index=True)


class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True)
    code = Column(String(60), unique=True, nullable=False)
    name = Column(String(160), nullable=False)
    description = Column(Text, default="")
    category = Column(String(60), default="GENERAL")
    severity = Column(String(20), default="MEDIUM")
    enabled = Column(Boolean, default=True)
    mandatory = Column(Boolean, default=False)
    config = Column(JSON, default=dict)
    updated_by = Column(String(200), default="system")
    updated_at = Column(DateTime, default=now)
    created_at = Column(DateTime, default=now)


class PolicyChange(Base):
    __tablename__ = "policy_changes"
    id = Column(Integer, primary_key=True)
    policy_code = Column(String(60), index=True)
    actor = Column(String(200))
    action = Column(String(60))
    old_value = Column(Text, default="")
    new_value = Column(Text, default="")
    created_at = Column(DateTime, default=now)


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    id = Column(Integer, primary_key=True)
    attempt_id = Column(Integer, nullable=True, index=True)
    simulation_id = Column(Integer, nullable=True)
    agent_name = Column(String(120))
    tool = Column(String(60))
    action = Column(String(60))
    args = Column(JSON, default=dict)
    args_canonical = Column(Text, default="")
    args_hash = Column(String(64), index=True)
    risk_score = Column(Integer, default=0)
    policies = Column(JSON, default=list)
    evidence = Column(JSON, default=dict)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED, EXPIRED, INVALIDATED, EXECUTED
    requested_at = Column(DateTime, default=now)
    expires_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(200), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    correlation_id = Column(String(64), default="")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor = Column(String(200), index=True)
    actor_role = Column(String(40), default="SYSTEM")
    action = Column(String(120), index=True)
    resource = Column(String(200), default="")
    result = Column(String(40), default="SUCCESS")
    correlation_id = Column(String(64), default="", index=True)
    evidence = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now, index=True)


class ReportRecord(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    name = Column(String(240), nullable=False)
    simulation_id = Column(Integer, nullable=True)
    scope = Column(String(60), default="GLOBAL")
    pdf_path = Column(String(400), default="")
    csv_path = Column(String(400), default="")
    json_path = Column(String(400), default="")
    generated_by = Column(String(200), default="system")
    created_at = Column(DateTime, default=now)


class MockEmail(Base):
    __tablename__ = "mock_emails"
    id = Column(Integer, primary_key=True)
    from_addr = Column(String(200))
    to_addr = Column(String(200))
    subject = Column(String(300))
    body = Column(Text, default="")
    classification = Column(String(30), default="INTERNAL")  # PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
    is_malicious = Column(Boolean, default=False)
    received_at = Column(DateTime, default=now)
    sent = Column(Boolean, default=False)
    read = Column(Boolean, default=False)


class MockWebpage(Base):
    __tablename__ = "mock_webpages"
    id = Column(Integer, primary_key=True)
    url = Column(String(300), unique=True)
    title = Column(String(300))
    body = Column(Text, default="")
    classification = Column(String(30), default="PUBLIC")
    is_malicious = Column(Boolean, default=False)


class MockDocument(Base):
    __tablename__ = "mock_documents"
    id = Column(Integer, primary_key=True)
    name = Column(String(300), unique=True)
    body = Column(Text, default="")
    classification = Column(String(30), default="INTERNAL")
    is_canary_holder = Column(Boolean, default=False)


class MockPayment(Base):
    __tablename__ = "mock_payments"
    id = Column(Integer, primary_key=True)
    invoice = Column(String(60), unique=True)
    vendor = Column(String(200))
    requester = Column(String(200))
    amount = Column(Float)
    currency = Column(String(10), default="INR")
    description = Column(Text, default="")
    classification = Column(String(30), default="INTERNAL")
    status = Column(String(30), default="PENDING")  # PENDING, VALIDATED, EXECUTED, REJECTED
    executed_at = Column(DateTime, nullable=True)
    executed_by = Column(String(200), nullable=True)


class CanarySecret(Base):
    __tablename__ = "canary_secrets"
    id = Column(Integer, primary_key=True)
    name = Column(String(120), unique=True)
    value = Column(String(300), unique=True)
    classification = Column(String(30), default="RESTRICTED")


class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(120), primary_key=True)
    value = Column(Text, default="")


Index("ix_toolcalls_attempt", ToolCall.attempt_id)
Index("ix_decisions_created", GuardianDecision.created_at)
Index("ix_audit_created", AuditLog.created_at)
