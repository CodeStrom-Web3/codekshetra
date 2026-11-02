// AGENTSHIELD — shared types (browser-embedded engine, mirrors backend/app/models.py)

export type Role = 'ADMIN' | 'SECURITY_ANALYST' | 'FINANCE_USER' | 'GENERAL_USER';
export type Decision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'SANITIZE_AND_RECHECK';
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SimMode = 'BASELINE' | 'PROTECTED' | 'COMPARATIVE';
export type SimStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'COMPLETED' | 'STOPPED' | 'FAILED';

export interface User {
  id: number; email: string; fullName: string; role: Role;
  passwordHash: string; salt: string; mustChangePassword: boolean; createdAt: string;
}
export interface AgentRecord {
  id: number; name: string; kind: 'RED_TEAM' | 'TARGET' | 'GUARDIAN';
  description: string; version: string; status: string;
  permissions: string[]; config: Record<string, unknown>; createdAt: string;
}
export interface AttackStep {
  tool: string; action: string; args: Record<string, unknown>;
  sourceContext: 'user' | 'email' | 'webpage' | 'document'; notes: string;
}
export interface Scenario {
  code: string; name: string; category: string; severity: Severity;
  vector: 'direct' | 'email' | 'webpage' | 'document' | 'benign';
  payload: string; description: string; expectedDecision: Decision; sourceRef: string;
  steps: AttackStep[]; isAttack: boolean; harmTools: string[];
}
export interface Simulation {
  id: number; name: string; mode: SimMode; status: SimStatus;
  scenarioCodes: string[]; rounds: number;
  totalAttempts: number; completedAttempts: number;
  attacksBlocked: number; attacksSucceeded: number;
  benignCompleted: number; benignBlocked: number;
  createdBy: string; createdAt: string; startedAt?: string; finishedAt?: string;
}
export interface SimulationRound {
  id: number; simulationId: number; roundNumber: number; label: string;
  mode: 'BASELINE' | 'PROTECTED'; adaptive: boolean;
  startedAt?: string; finishedAt?: string;
}
export interface AttackAttempt {
  id: number; simulationId: number; round: number; roundMode: 'BASELINE' | 'PROTECTED';
  adaptive: boolean; scenarioCode: string; scenarioName: string; category: string;
  severity: Severity; isAttack: boolean; expectedDecision: string; finalDecision: Decision;
  riskScore: number; attackSucceeded: boolean; outcome: string;
  durationMs: number; correlationId: string; payload: string;
  startedAt: string; finishedAt?: string;
}
export interface ToolCallRecord {
  id: number; attemptId?: number; simulationId?: number; agent: string;
  tool: string; action: string; args: Record<string, unknown>; argsHash: string;
  decision: Decision; decisionSource: 'GUARDIAN' | 'BASELINE'; executed: boolean; sanitized: boolean;
  resultSummary: string; baseRisk: number; riskBreakdown: Record<string, unknown>;
  riskScore: number; createdAt: string;
}
export interface RuleHit { code: string; name: string; severity: string; detail: string; weight: number }
export interface GuardianDecisionRecord {
  id: number; toolCallId: number; attemptId?: number; decision: Decision;
  riskScore: number; severity: Severity; triggeredRules: RuleHit[];
  rationale: string; evidence: Record<string, unknown>; createdAt: string;
}
export interface Policy {
  id: number; code: string; name: string; description: string; category: string;
  severity: Severity; enabled: boolean; mandatory: boolean;
  config: Record<string, unknown>; updatedBy: string; updatedAt: string; createdAt: string;
}
export interface PolicyChange {
  id: number; policyCode: string; actor: string; action: string;
  oldValue: string; newValue: string; createdAt: string;
}
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'INVALIDATED' | 'EXECUTED';
export interface Approval {
  id: number; attemptId?: number; simulationId?: number;
  agent: string; tool: string; action: string; args: Record<string, unknown>;
  argsCanonical: string; argsHash: string; riskScore: number;
  policies: string[]; evidence: Record<string, unknown>;
  status: ApprovalStatus; requestedAt: string; expiresAt: string;
  reviewedBy?: string; reviewedAt?: string; correlationId: string;
}
export interface AuditEntry {
  id: number; actor: string; actorRole: string; action: string; resource: string;
  result: string; correlationId: string; evidence: Record<string, unknown>; createdAt: string;
}
export interface Metrics {
  sampleSize: number; attackCount: number; benignCount: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  attackBlockRate: number | null; attackSuccessRate: number | null;
  legitimateCompletionRate: number | null; falsePositiveRate: number | null;
  precision: number | null; recall: number | null; utilityRetention: number | null;
  avgRiskScore: number | null; defenceIndex: number | null; defenceIndexNote: string;
}
export interface EmailRecord {
  id: number; from: string; to: string; subject: string; body: string;
  classification: string; isMalicious: boolean; receivedAt: string; sent: boolean; read: boolean;
}
export interface WebpageRecord {
  id: number; url: string; title: string; body: string; classification: string; isMalicious: boolean;
}
export interface DocumentRecord {
  id: number; name: string; body: string; classification: string; isCanaryHolder: boolean;
}
export interface PaymentRecord {
  id: number; invoice: string; vendor: string; requester: string; amount: number;
  currency: string; description: string; classification: string;
  status: 'PENDING' | 'VALIDATED' | 'EXECUTED' | 'REJECTED'; executedAt?: string; executedBy?: string;
}
export interface CanarySecret { id: number; name: string; value: string; classification: string }
export interface ReportRecord {
  id: number; name: string; scope: string; simulationId?: number;
  generatedBy: string; createdAt: string;
  snapshot: Record<string, unknown>;
}
export interface DB {
  users: User[]; agents: AgentRecord[]; scenarios: Scenario[];
  simulations: Simulation[]; rounds: SimulationRound[]; attempts: AttackAttempt[];
  toolCalls: ToolCallRecord[]; decisions: GuardianDecisionRecord[];
  policies: Policy[]; policyChanges: PolicyChange[]; approvals: Approval[]; audit: AuditEntry[];
  reports: ReportRecord[]; emails: EmailRecord[]; webpages: WebpageRecord[];
  documents: DocumentRecord[]; payments: PaymentRecord[]; canaries: CanarySecret[];
  settings: Record<string, string>;
  seq: Record<string, number>;
}
