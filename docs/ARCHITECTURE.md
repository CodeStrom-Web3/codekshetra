# AGENTSHIELD — Architecture

## Two runtime modes, one engine design

### A. Browser-embedded engine (this preview)
`src/engine/*.ts` is a faithful TypeScript port of the Python backend:

```
src/engine/
  types.ts       shared record types (mirrors SQLAlchemy models)
  sha256.ts      dependency-free SHA-256 + canonical JSON (approval hash binding)
  data.ts        seeded universe: users, agents, policies, corpus, canaries
  scenarios.ts   31 deterministic scenarios (25 attacks, 6 benign) with steps & harm tools
  guardian.ts    injection patterns, DLP canaries, risk model, decision logic — AUTHORITATIVE
  tools.ts       4 mock tools (email/browser/files/payments), schema validation, execution
  gateway.ts     THE ONLY PATH to tools: schema → guardian → approval(SHA-256) → execute → audit
  store.ts       DB handle, localStorage persistence, auth, metrics, simulation runner
  reports.ts     PDF (jsPDF) / CSV / JSON from persisted records
```

Persistence: versioned `localStorage` (`agentshield.db.v1`). Auth: salted demo KDF +
issued session record (8h expiry). Suitable for single-analyst, zero-cost demos.

### B. Full-stack mode (`backend/`)
FastAPI + SQLAlchemy + SQLite + WebSockets, identical pipeline:

```
backend/app/
  main.py          REST + WS routes, RBAC dependencies, startup seed
  models.py        users, agents, scenarios, simulations, attempts, tool calls,
                   guardian decisions, policies, approvals, audit, reports, corpus
  security.py      PBKDF2-SHA256 hashing (stdlib), HS256 JWT, role hierarchy
  gateway.py       pipeline: ToolRejection → schema → Guardian → decision → approval → execute → audit
  guardian.py      injection scan, canary DLP, base-risk model, mandatory overrides
  gateway_schemas.py  Pydantic strict models per action (extra=forbid)
  tools/           email, browser, files, payments mock tools (DB-backed)
  simulations.py   3-round engine, pause/resume/stop/restart, adaptive mutations
  analytics.py     confusion-matrix metrics, N/A-on-zero-denominators
  reports.py       ReportLab PDF (8 sections), CSV, JSON
  ws.py            connection manager + thread-safe broadcast bridge
```

## Data flow

```
Red Team step → gateway.call()
  1. resolve tool/action (allowlist)         → unknown = BLOCK
  2. Pydantic/exact-schema validation        → invalid = BLOCK (schema_rejected)
  3. Guardian.evaluate():                      authorization (P1/P7) → DLP canary sweep →
      injection scan (16 patterns) → resource classification (P2) → payment rules (P3) →
      email rules (P4) → file rules (P6) → sequence detection (P9) → risk 0–100
  4. Decision: DLP/mandatory → BLOCK · injection+untrusted+high-sev → BLOCK ·
      injection+untrusted → SANITIZE_AND_RECHECK · sensitive → REQUIRE_APPROVAL ·
      risk≥70 → BLOCK · risk≥45 → REQUIRE_APPROVAL · else ALLOW
  5. REQUIRE_APPROVAL: create bound approval (agent+tool+canonical SHA-256, 15 min TTL).
      With approval token: revalidate agent/tool/action/hash/expiry — mismatch = BLOCK.
  6. Mock tool executes (synthetic state change only) → ToolCall + GuardianDecision + AuditLog
```

## Simulation engine
`runSimulation()` iterates rounds × scenarios. Round 1/3 = PROTECTED, round 2 = BASELINE
in COMPARATIVE mode. Benign outcome = COMPLETED unless every path to completion is blocked
(→ BLOCKED_FP, false positive). Attack outcome = SUCCEEDED only if a harm tool executed or a
canary left the sandbox — measured via DB state, never agent claims. Between rounds the
payment ledger resets so rounds are directly comparable.

## Frontend
React 19 + Vite + Tailwind v4 + HashRouter + Chart.js + jsPDF + Framer Motion.
Dark command-center aesthetic; pages: Landing, Login, Dashboard, Agents (+live sandbox
console), Simulations (launch/control/history), Scenario Library, Live Monitor,
Guardian Feed, Policies (+test bench), Approvals (+tamper probe), Analytics,
Audit Logs, Reports, Settings.
