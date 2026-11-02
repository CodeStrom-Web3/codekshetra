// AGENTSHIELD — Tool Gateway (browser port). THE ONLY path to mock tools.
// Pipeline: Schema → Permission/Guardian → Decision → Approval(SHA-256) → Execute → Audit.
import type { DB, Decision, GuardianDecisionRecord, ToolCallRecord, RuleHit, Severity } from './types';
import { ACTION_SCHEMAS, TOOL_ACTIONS, executeMockTool } from './tools';
import { evaluateWithGuardian, scanInjection } from './guardian';
import { canonicalJson, canonicalHash } from './sha256';

export interface GatewayCallOptions {
  attemptId?: number;
  simulationId?: number;
  protected: boolean;             // false = BASELINE mode (Guardian bypassed, sandbox retained)
  agent?: string;
  sourceContext?: string;
  notes?: string;
  priorActions?: Array<{ tool: string; action: string }>;
  approvalToken?: { id: number } | null;
  actorRole?: string;
}

export interface GatewayResult {
  correlationId: string;
  toolCallId: number;
  tool: string; action: string; args: Record<string, unknown>;
  argsHash: string; decision: Decision;
  riskScore: number; severity: string;
  rationale: string; triggeredRules: RuleHit[];
  riskBreakdown: Record<string, unknown>; baseRisk: number;
  evidence: Record<string, unknown>;
  executed: boolean; sanitized: boolean;
  result: Record<string, unknown>;
  approvalId?: number;
}

function summarize(tool: string, action: string, result: Record<string, unknown>): string {
  if (result.error) return `error: ${String(result.error).slice(0, 280)}`;
  if (tool === 'email' && action === 'send') return `simulated send to ${result.to} (id ${result.sent_id})`;
  if (tool === 'email' && action === 'draft') return `draft created (id ${result.draft_id})`;
  if (tool === 'email') return `${result.count ?? (result.found ? '1' : '?')} item(s) returned`;
  if (tool === 'payments' && action === 'execute')
    return `simulated payment ${result.reference ?? ''} ${String(result.amount ?? '')}`;
  if (tool === 'payments') return `invoice ${result.invoice ?? 'list'} → ${JSON.stringify(result).slice(0, 120)}`;
  if (tool === 'files') return `${result.count ?? result.found ?? result.created ?? ''} ${result.name ?? ''}`;
  return JSON.stringify(result).slice(0, 200);
}

export function gatewayCall(db: DB, tool: string, action: string, rawArgs: Record<string, unknown>,
                           opts: GatewayCallOptions): GatewayResult {
  const correlationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const agent = opts.agent ?? 'target-agent';
  const args = rawArgs ?? {};

  const finish = (partial: Omit<GatewayResult, 'correlationId' | 'toolCallId'>, executed: boolean, summary: string): GatewayResult => {
    const tc: ToolCallRecord = {
      id: 0, attemptId: opts.attemptId, simulationId: opts.simulationId,
      agent, tool, action, args: partial.args, argsHash: partial.argsHash,
      decision: partial.decision, decisionSource: opts.protected ? 'GUARDIAN' : 'BASELINE',
      executed, sanitized: partial.sanitized, resultSummary: summary,
      baseRisk: partial.baseRisk, riskBreakdown: partial.riskBreakdown,
      riskScore: partial.riskScore, createdAt: now,
    };
    db.toolCalls.push(tc); // id assigned by caller (store.nextId)
    return { ...partial, correlationId, toolCallId: 0 };
  };

  // ── 1. Tool & action resolution + schema validation
  const actions = TOOL_ACTIONS[tool];
  const schema = actions ? ACTION_SCHEMAS[tool][action] : undefined;
  if (!actions || !schema) {
    const evaln = {
      decision: 'BLOCK' as Decision, riskScore: 100, severity: 'CRITICAL',
      triggeredRules: [{ code: 'TOL-REJ', name: 'Unknown tool/action', severity: 'CRITICAL',
                         detail: `Unknown tool or action: ${tool}.${action}`, weight: 100 }],
      rationale: `Unknown tool/action ${tool}.${action} — gateway allowlist rejected the call.`,
      evidence: { error: `unknown tool ${tool}.${action}` }, baseRisk: 0,
      riskBreakdown: { schema_rejection: 100 },
    };
    const res = finish({ tool, action, args, argsHash: sha(args), ...evaln, executed: false, sanitized: false, result: { status: 'schema_rejected' } },
      false, evaln.rationale);
    persistDecision(db, res, opts, now);
    audit(db, agent, 'AGENT', `tool.${tool}.${action}`, '', 'BLOCK', correlationId, { schema_rejection: true });
    return res;
  }

  const parsed = schema(args);
  if (!parsed.ok || !parsed.value) {
    const evaln = {
      decision: 'BLOCK' as Decision, riskScore: 100, severity: 'CRITICAL',
      triggeredRules: [{ code: 'SCH-REJ', name: 'Schema validation failure', severity: 'CRITICAL',
                         detail: parsed.error ?? 'invalid arguments', weight: 100 }],
      rationale: `Schema validation failed: ${parsed.error}`,
      evidence: { error: parsed.error }, baseRisk: 0, riskBreakdown: { schema_rejection: 100 },
    };
    const res = finish({ tool, action, args, argsHash: sha(args), ...evaln, executed: false, sanitized: false, result: { status: 'schema_rejected' } },
      false, evaln.rationale);
    persistDecision(db, res, opts, now);
    audit(db, agent, 'AGENT', `tool.${tool}.${action}`, '', 'BLOCK', correlationId, { schema_rejection: parsed.error });
    return res;
  }

  let cleanArgs = parsed.value;
  let argsHash = canonicalHash(cleanArgs);

  // ── 2. Guardian evaluation (or baseline bypass)
  const prior = (opts.priorActions ?? []).map((p) => ({ tool: p.tool, action: p.action }));
  let evaluation = opts.protected
    ? evaluateWithGuardian(db, {
        tool, action, args: cleanArgs, agent,
        sourceContext: opts.sourceContext ?? 'user', notes: opts.notes ?? '', priorActions: prior,
      })
    : baselineEvaluation(tool, action);

  let sanitized = false;
  if (opts.protected && evaluation.decision === 'SANITIZE_AND_RECHECK') {
    const scrub = (v: unknown): unknown => {
      if (typeof v !== 'string') return v;
      return v.split('\n').map((line) => scanInjection(line).length ? '[REDACTED-BY-GUARDIAN]' : line)
        .join('\n')
        .replace(/(ignore|disregard|forget)\s[^\n]*/gi, '[REDACTED-BY-GUARDIAN]');
    };
    const sanitizedArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cleanArgs)) {
      sanitizedArgs[k] = ['body', 'content', 'subject', 'description', 'query'].includes(k) ? scrub(v) : v;
    }
    sanitized = JSON.stringify(sanitizedArgs) !== JSON.stringify(cleanArgs);
    cleanArgs = sanitizedArgs;
    argsHash = canonicalHash(cleanArgs);
    const recheck = evaluateWithGuardian(db, {
      tool, action, args: cleanArgs, agent,
      sourceContext: opts.sourceContext ?? 'user', notes: '', priorActions: prior,
    });
    evaluation = {
      ...recheck,
      rationale: `SANITIZE_AND_RECHECK: instruction-like content stripped; re-evaluation clean. ${recheck.rationale}`,
    };
  }

  let decision = evaluation.decision;
  let rationale = evaluation.rationale;

  // ── 3. Approval handling
  if (decision === 'REQUIRE_APPROVAL') {
    if (opts.approvalToken) {
      const verdict = verifyApproval(db, opts.approvalToken.id, agent, tool, action, cleanArgs, argsHash);
      if (verdict.ok) {
        decision = 'ALLOW';
        rationale = `Approval #${opts.approvalToken.id} revalidated OK (agent + tool + SHA-256 args hash + expiry). ${evaluation.rationale}`;
        evaluation = { ...evaluation, decision, rationale };
      } else {
        decision = 'BLOCK';
        rationale = `APPROVAL REJECTED AT GATEWAY: ${verdict.reason}`;
        evaluation = { ...evaluation, decision, rationale };
      }
    } else {
      // create approval request instead of executing
      const approvalId = db.seq.approvals = (db.seq.approvals ?? 0) + 1;
      const id = approvalId;
      db.approvals.push({
        id, attemptId: opts.attemptId, simulationId: opts.simulationId,
        agent, tool, action, args: cleanArgs,
        argsCanonical: canonicalJson(cleanArgs), argsHash,
        riskScore: evaluation.riskScore,
        policies: evaluation.triggeredRules.map((r) => r.code),
        evidence: evaluation.evidence, status: 'PENDING',
        requestedAt: now,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        correlationId,
      });
      const res = finish({
        tool, action, args: cleanArgs, argsHash, decision,
        riskScore: evaluation.riskScore, severity: evaluation.severity,
        rationale, triggeredRules: evaluation.triggeredRules,
        riskBreakdown: evaluation.riskBreakdown, baseRisk: evaluation.baseRisk,
        evidence: evaluation.evidence, executed: false, sanitized,
        result: { status: 'awaiting_approval', approval_id: id },
      }, false, `Awaiting human approval (request #${id})`);
      res.approvalId = id;
      persistDecision(db, res, opts, now);
      audit(db, agent, 'AGENT', `tool.${tool}.${action}`, describeTarget(cleanArgs), 'REQUIRE_APPROVAL', correlationId,
        { risk: evaluation.riskScore, approval_id: id });
      return res;
    }
  }

  if (decision === 'BLOCK') {
    const res = finish({
      tool, action, args: cleanArgs, argsHash, decision,
      riskScore: evaluation.riskScore, severity: evaluation.severity,
      rationale, triggeredRules: evaluation.triggeredRules,
      riskBreakdown: evaluation.riskBreakdown, baseRisk: evaluation.baseRisk,
      evidence: evaluation.evidence, executed: false, sanitized,
      result: { status: 'blocked' },
    }, false, opts.protected ? 'Blocked by Guardian' : 'Blocked (schema/baseline)');
    persistDecision(db, res, opts, now);
    audit(db, agent, 'AGENT', `tool.${tool}.${action}`, describeTarget(cleanArgs), 'BLOCK', correlationId,
      { risk: evaluation.riskScore, rules: evaluation.triggeredRules.map((r) => r.code) });
    return res;
  }

  // ── 4. Execute mock tool
  const result = executeMockTool(db, tool, action, cleanArgs, { actor: agent, correlationId });
  const res = finish({
    tool, action, args: cleanArgs, argsHash, decision,
    riskScore: evaluation.riskScore, severity: evaluation.severity,
    rationale, triggeredRules: evaluation.triggeredRules,
    riskBreakdown: evaluation.riskBreakdown, baseRisk: evaluation.baseRisk,
    evidence: evaluation.evidence, executed: true, sanitized, result,
  }, true, summarize(tool, action, result));
  persistDecision(db, res, opts, now);
  audit(db, agent, 'AGENT', `tool.${tool}.${action}`, describeTarget(cleanArgs), decision, correlationId,
    { risk: evaluation.riskScore, executed: true });
  return res;
}

function baselineEvaluation(tool: string, action: string) {
  return {
    decision: 'ALLOW' as Decision, riskScore: 0, severity: 'INFO' as Severity,
    triggeredRules: [] as RuleHit[],
    rationale: 'BASELINE MODE — Guardian bypassed (pre-deployment posture). Sandboxing, schema validation and audit retained.',
    evidence: { mode: 'BASELINE', tool, action },
    baseRisk: 0, riskBreakdown: { baseline_bypass: true } as Record<string, unknown>,
  };
}

export function verifyApproval(db: DB, id: number, agent: string, tool: string, action: string,
                              args: Record<string, unknown>, argsHash: string): { ok: boolean; reason: string } {
  const row = db.approvals.find((a) => a.id === id);
  if (!row) return { ok: false, reason: 'approval request not found' };
  if (row.status !== 'APPROVED') return { ok: false, reason: `approval status is ${row.status}, expected APPROVED` };
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    row.status = 'EXPIRED';
    return { ok: false, reason: 'approval expired' };
  }
  if (row.agent !== agent) return { ok: false, reason: `agent mismatch (approval bound to ${row.agent})` };
  if (row.tool !== tool || row.action !== action) {
    return { ok: false, reason: `tool/action mismatch (approval bound to ${row.tool}.${row.action})` };
  }
  if (canonicalHash(args) !== row.argsHash) {
    return { ok: false, reason: 'ARGUMENT HASH MISMATCH — arguments changed after approval (tampering)' };
  }
  return { ok: true, reason: 'ok' };
}

function persistDecision(db: DB, res: GatewayResult, opts: GatewayCallOptions, now: string) {
  const tcId = (db.seq.toolCalls = (db.seq.toolCalls ?? 0) + 1);
  const tc = db.toolCalls[db.toolCalls.length - 1];
  if (tc) tc.id = tcId;
  res.toolCallId = tcId;
  const decId = (db.seq.decisions = (db.seq.decisions ?? 0) + 1);
  const decision: GuardianDecisionRecord = {
    id: decId, toolCallId: tcId, attemptId: opts.attemptId,
    decision: res.decision, riskScore: res.riskScore,
    severity: res.severity as GuardianDecisionRecord['severity'],
    triggeredRules: res.triggeredRules, rationale: res.rationale,
    evidence: res.evidence, createdAt: now,
  };
  db.decisions.push(decision);
}

export function audit(db: DB, actor: string, actorRole: string, action: string, resource: string,
                     result: string, correlationId: string, evidence: Record<string, unknown>) {
  const id = (db.seq.audit = (db.seq.audit ?? 0) + 1);
  db.audit.push({
    id, actor, actorRole, action, resource, result, correlationId,
    evidence, createdAt: new Date().toISOString(),
  });
}

function describeTarget(args: Record<string, unknown>): string {
  return String(args.invoice ?? args.name ?? args.url ?? args.to ?? args.email_id ?? args.query ?? '');
}

function sha(args: Record<string, unknown>) {
  return canonicalHash(args);
}
