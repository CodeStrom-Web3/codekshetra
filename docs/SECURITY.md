# AGENTSHIELD — Security Model & Threat Model

## Assets
Synthetic enterprise: agents, mock corpus, canary secrets (payroll API key, ERP token),
payment ledger, audit trail. No real assets exist in this system by design.

## Trust boundaries
Every agent output is **untrusted**. Tool output re-enters context as **data**, never as
instruction. The gateway is the only trust boundary that matters; the Target Agent has no
other path to tools.

## Threat classes covered (see Scenarios page)
Direct/indirect prompt injection · goal hijacking · jailbreak personas · unauthorized tools ·
data extraction · privilege escalation · payment manipulation (BEC) · suspicious tool chains
(read→exfiltrate, execute-without-validate) · context manipulation · approval bypass & tampering ·
encoded payloads · concealment directives · authority impersonation.

## Approval integrity (P8)
Approvals bind `agent + tool + action + canonical_args` via SHA-256 (sorted keys, compact
separators). At execution the gateway recomputes the hash. Failures → BLOCK:
- argument mutation post-approval (tamper)
- wrong agent replaying the token
- expired token (15-minute TTL)
- replayed/consumed token with wrong action

Demo: Approvals → lock icon performs a tamper probe.

## Mandatory controls (cannot be disabled)
P1 Least Privilege · P2 Confidential Data (canary DLP) · P3 Payment Authorization ·
P5 Untrusted Content Isolation · P7 Tool Allowlist · P8 Approval Integrity.
P6 (File Access) and P9 (Sequences) are advisory-tunable; P4 (Email Confirm) and P10 (DLP-Outbound) active.

## Risk model (transparent, 0–100)
`base(tool,action) + data_sensitivity + min(60, injection_signals) + canary(45) + prior_actions + allowlist_penalty`,
clamped. Breakdown is persisted per call and shown in the Guardian Feed. Block ≥70; approval band 45–69.

## Known limitations (honest)
- Browser-mode sessions are demo KDF-based (no server authority); backend uses PBKDF2 + JWT.
- Single-tenant synthetic corpus; no network egress exists to escape.
- SQLite single-writer; audit rows are application-append-only, not WORM.
- Deterministic detector regexes can be evaded in principle — hence layered signals + mandatory human approval for irreversible actions.
- Defence Index is a documented heuristic, not a certification of security.
