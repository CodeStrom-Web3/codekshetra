# AGENTSHIELD — Autonomous AI Agent Security Testing & Defence Platform

**Red Team vs Blue Team range for enterprise AI agents.** A hostile Red Team fires
synthetic attacks at a tool-using Target Agent; the Blue Team Guardian intercepts every
tool call, scores risk, enforces mandatory policy and demands SHA-256-bound human
approval for sensitive actions. Everything is evidence: persisted, measurable, exportable.

- **Zero cost** — no paid APIs, keys or subscriptions. Runs locally on Windows/macOS/Linux.
- **Fictional data only** — reserved example domains (`nexacorp.example`, `*.example`),
  synthetic mailboxes/intranet/documents/payments. No real systems are ever touched.
- **Offline-capable** — the deployed preview runs the *entire engine in the browser*
  (gateway, Guardian, simulations, reports). The full-stack mode ships in `backend/`.

## Quick start

### Frontend (static — what this Vercel preview serves)
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

### Backend (FastAPI + SQLite)
```bash
cd backend
pip install fastapi "uvicorn[standard]" sqlalchemy pydantic passlib python-jose python-multipart httpx pytest reportlab
python -m app.seed            # or let startup seed automatically
uvicorn app.main:app --port 8000
```
API docs: `http://localhost:8000/docs` · Health: `http://localhost:8000/api/health`

### Tests
```bash
cd backend && pytest tests/ -q      # 19 tests: auth/RBAC, gateway, injection, DLP, approvals, metrics, reports, WS
```

## Demo credentials (seeded)
| Email | Password | Role |
|---|---|---|
| admin@nexacorp.example | AgentShield-Demo-2026! | ADMIN |
| analyst@nexacorp.example | Analyst-Demo-2026! | SECURITY_ANALYST |
| finance@nexacorp.example | Finance-Demo-2026! | FINANCE_USER |
| user@nexacorp.example | User-Demo-2026! | GENERAL_USER |

Admin is flagged `must_change_password` (demo). Rotate in Settings → Account.

## The three agents
- **Red Team** — deterministic scenario engine (31 seeded scenarios, 10 attack families) with
  optional local Ollama/Qwen3-4B variation. Adaptive round-3 payload mutation.
- **Target Agent** — enterprise assistant: synthetic inbox, *.nexacorp.example intranet,
  authorized documents, mock payment reviews. **Proposes** tool calls; never executes them.
- **Blue Team Guardian** — inspects every proposed action: 16 injection patterns, canary DLP,
  least-privilege allowlists, sequence detection. LLM advisory; **deterministic policy authoritative**.

## The gateway invariant
`Target → Tool Gateway → Schema Validation → Permission Check → Guardian → Policy Engine → Decision → Approval (SHA-256) → Mock Tool → Audit Log`

Decisions: `ALLOW` · `BLOCK` · `REQUIRE_APPROVAL` · `SANITIZE_AND_RECHECK`.
Mandatory policy (P1/P2/P3/P5/P7/P8) always overrides risk scores.

## 3-round simulation doctrine
- **Round 1** — protected gateway, initial attacks.
- **Round 2** — COMPARATIVE mode replays identical attacks with the Guardian *bypassed*
  (sandboxing + schema validation + audit retained). The delta vs round 1 is the Guardian's
  measured value-add.
- **Round 3** — adaptive: Red Team mutates payloads (urgency+concealment, fake approval
  claims, role-tag injection) informed by prior outcomes.

## Metrics (all evidence-based, N/A on zero denominators)
Attack Block Rate · Attack Success Rate · Legitimate Completion Rate · False Positive Rate ·
Precision · Recall · Utility Retention · Defence Index (documented heuristic composite — **not a certification**).

## Docs
`docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/DEMO_SCRIPT.md` · `docs/INSTALLATION.md`

## Honest limitations
- Synthetic data only; no real defense guarantees — this is a testing range.
- SQLite/browser storage is single-writer (use the backend + Postgres for multi-analyst concurrency).
- Browser-mode auth is demo-grade (paired sessions); backend uses PBKDF2-HMAC-SHA256 + HS256 JWT.
- Metrics are sample-size dependent; Defence Index is a heuristic, not a certification.
- LLM variation (Ollama) is advisory; deterministic cases ensure reproducible demos.
