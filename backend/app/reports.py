"""Report generation from persisted records — PDF (ReportLab), CSV, JSON."""
import csv, json, os
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from .analytics import (compute_metrics, category_breakdown, decision_distribution,
                        rounds_breakdown, policy_hit_counts)
from .models import AttackAttempt, Simulation, ReportRecord, AuditLog, ApprovalRequest
from .database import REPORTS_DIR


def generate_reports(db: Session, simulation_id: int | None, generated_by: str) -> ReportRecord:
    sim = db.query(Simulation).filter(Simulation.id == simulation_id).first() if simulation_id else None
    scope = f"simulation#{simulation_id}" if sim else "GLOBAL"
    name = f"AGENTSHIELD-{'SIM' + str(simulation_id) if simulation_id else 'GLOBAL'}-{datetime.utcnow():%Y%m%d-%H%M%S}"

    metrics = compute_metrics(db, simulation_id)
    categories = category_breakdown(db, simulation_id)
    decisions = decision_distribution(db, simulation_id)
    rounds = rounds_breakdown(db, simulation_id)
    policy_hits = policy_hit_counts(db)
    q = db.query(AttackAttempt)
    if simulation_id:
        q = q.filter(AttackAttempt.simulation_id == simulation_id)
    attempts = q.order_by(AttackAttempt.id).all()
    fp_attempts = [a for a in attempts if a.is_attack is False and a.outcome == "BLOCKED_FP"]
    succeeded = [a for a in attempts if a.is_attack and a.attack_succeeded]

    pdf_path = REPORTS_DIR / f"{name}.pdf"
    csv_path = REPORTS_DIR / f"{name}.csv"
    json_path = REPORTS_DIR / f"{name}.json"

    _write_json(json_path, {"name": name, "scope": scope, "generated_by": generated_by,
                            "generated_at": datetime.utcnow().isoformat() + "Z",
                            "metrics": metrics, "categories": categories,
                            "decisions": decisions, "rounds": rounds,
                            "policy_hits": policy_hits,
                            "attempts": [_attempt_dict(a) for a in attempts]})
    _write_csv(csv_path, attempts, metrics)
    _write_pdf(pdf_path, name, scope, sim, metrics, categories, decisions, rounds,
               policy_hits, attempts, fp_attempts, succeeded, generated_by)

    rec = ReportRecord(name=name, simulation_id=simulation_id, scope=scope,
                       pdf_path=str(pdf_path), csv_path=str(csv_path), json_path=str(json_path),
                       generated_by=generated_by)
    db.add(rec)
    db.add(AuditLog(actor=generated_by, actor_role="USER", action="report.generate",
                    resource=name, result="SUCCESS", correlation_id=name,
                    evidence={"scope": scope, "attempts": len(attempts)}))
    db.commit()
    db.refresh(rec)
    return rec


def _attempt_dict(a: AttackAttempt):
    return {"id": a.id, "round": a.round_number, "mode": a.round_mode, "adaptive": a.adaptive,
            "scenario": a.scenario_code, "category": a.category, "severity": a.severity,
            "is_attack": a.is_attack, "expected": a.expected_decision,
            "final_decision": a.final_decision, "risk": a.risk_score,
            "outcome": a.outcome, "duration_ms": a.duration_ms,
            "time": a.started_at.isoformat() if a.started_at else None}


def _write_json(path: Path, payload: dict):
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def _write_csv(path: Path, attempts, metrics):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["# AGENTSHIELD simulation export", datetime.utcnow().isoformat() + "Z"])
        w.writerow(["metric", "value"])
        for k, v in metrics.items():
            if isinstance(v, (dict, list)):
                continue
            w.writerow([k, v if v is not None else "N/A"])
        w.writerow([])
        w.writerow(["attempt_id", "round", "mode", "scenario", "category", "severity",
                    "is_attack", "expected", "final_decision", "risk", "outcome", "duration_ms"])
        for a in attempts:
            w.writerow([a.id, a.round_number, a.round_mode, a.scenario_code, a.category,
                        a.severity, a.is_attack, a.expected_decision, a.final_decision,
                        a.risk_score, a.outcome, a.duration_ms])


def _write_pdf(path: Path, name, scope, sim, metrics, categories, decisions, rounds,
               policy_hits, attempts, fp_attempts, succeeded, generated_by):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                     HRFlowable, PageBreak)

    NAVY = colors.HexColor("#0b1220")
    CYAN = colors.HexColor("#22d3ee")
    GREY = colors.HexColor("#94a3b8")
    DARK = colors.HexColor("#111c33")

    styles = {
        "title": ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=26, textColor=NAVY, leading=32),
        "sub": ParagraphStyle("sub", fontName="Helvetica", fontSize=11, textColor=GREY, leading=15),
        "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=15, textColor=NAVY, spaceBefore=14, spaceAfter=6, leading=19),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=colors.HexColor("#1f2937")),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=11, textColor=GREY),
    }

    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=name, author="AGENTSHIELD")
    story = []

    story.append(Paragraph("AGENTSHIELD", styles["title"]))
    story.append(Paragraph("Autonomous AI Agent Security Testing & Defence — Simulation Report", styles["sub"]))
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=2, color=CYAN))
    story.append(Spacer(1, 8))

    meta = Table([
        ["Report", name], ["Scope", scope],
        ["Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")],
        ["Generated by", generated_by],
        ["Simulation mode", sim.mode if sim else "GLOBAL (all persisted data)"],
    ], colWidths=[42 * mm, 120 * mm])
    meta.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                              ("TEXTCOLOR", (0, 0), (0, -1), NAVY), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story.append(meta)
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Executive Summary", styles["h1"]))
    m = metrics
    def fmt(v):
        return f"{v}%" if v is not None else "N/A"
    story.append(Paragraph(
        f"Across <b>{m['sample_size']}</b> persisted attempt(s) — <b>{m['attack_count']}</b> attacks and "
        f"<b>{m['benign_count']}</b> legitimate tasks — the protected pipeline blocked "
        f"<b>{fmt(m['attack_block_rate'])}</b> of attacks (attack success rate {fmt(m['attack_success_rate'])}). "
        f"Legitimate tasks completed at <b>{fmt(m['legitimate_completion_rate'])}</b> with a false-positive rate of "
        f"<b>{fmt(m['false_positive_rate'])}</b>. Guardian precision <b>{fmt(m['precision'])}</b>, recall "
        f"<b>{fmt(m['recall'])}</b>. Composite AGENTSHIELD Defence Index (mean of block/precision/utility): "
        f"<b>{m['defence_index'] if m['defence_index'] is not None else 'N/A'}</b> — heuristic only, not a certification.",
        styles["body"]))

    story.append(Paragraph("2. Evidence-Based Metrics", styles["h1"]))
    cm = m["confusion"]
    rows = [["Metric", "Value", "Basis"],
            ["Attack Block Rate", fmt(m["attack_block_rate"]), f"TP {cm['tp']} / attacks {m['attack_count']}"],
            ["Attack Success Rate", fmt(m["attack_success_rate"]), f"FN {cm['fn']} / attacks {m['attack_count']}"],
            ["Legitimate Completion Rate", fmt(m["legitimate_completion_rate"]), f"TN {cm['tn']} / benign {m['benign_count']}"],
            ["False Positive Rate", fmt(m["false_positive_rate"]), f"FP {cm['fp']} / benign {m['benign_count']}"],
            ["Precision", fmt(m["precision"]), f"TP {cm['tp']} / (TP {cm['tp']} + FP {cm['fp']})"],
            ["Recall", fmt(m["recall"]), f"TP {cm['tp']} / (TP {cm['tp']} + FN {cm['fn']})"],
            ["Utility Retention", fmt(m["utility_retention"]), f"TN {cm['tn']} / benign {m['benign_count']}"],
            ["Avg attack risk score", str(m["avg_risk_score"]) if m["avg_risk_score"] is not None else "N/A", "mean over attack attempts"],
            ["Sample size", str(m["sample_size"]), "persisted attempts"]]
    t = Table(rows, colWidths=[52 * mm, 30 * mm, 80 * mm])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Paragraph("N/A is reported when a denominator is zero. Confusion matrix ground truth: "
                           "attack → blocked/approved-gated = TP; attack succeeded = FN; benign completed = TN; benign blocked = FP.",
                           styles["small"]))

    story.append(Paragraph("3. Attack Outcomes by Category", styles["h1"]))
    rows = [["Category", "Attempts", "Blocked", "Succeeded"]] + [
        [c["category"], str(c["attempts"]), str(c["blocked"]), str(c["succeeded"])] for c in categories]
    t = Table(rows, colWidths=[70 * mm, 30 * mm, 30 * mm, 32 * mm])
    t.setStyle(_table_style())
    story.append(t)

    story.append(Paragraph("4. Guardian Decision Distribution", styles["h1"]))
    rows = [["Decision", "Count"]] + [[d["decision"], str(d["count"])] for d in decisions]
    t = Table(rows, colWidths=[70 * mm, 40 * mm])
    t.setStyle(_table_style())
    story.append(t)

    story.append(Paragraph("5. Round Breakdown (Initial → Baseline replay → Adaptive)", styles["h1"]))
    rows = [["Round", "Mode", "Attempts", "Succeeded"]] + [
        [str(r["round"]), r["mode"], str(r["attempts"]), str(r["succeeded"])] for r in rounds]
    t = Table(rows, colWidths=[22 * mm, 40 * mm, 34 * mm, 34 * mm])
    t.setStyle(_table_style())
    story.append(t)

    story.append(Paragraph("6. Most-Triggered Guardian Rules", styles["h1"]))
    rows = [["Rule", "Triggers"]] + [[p["rule"], str(p["count"])] for p in policy_hits[:12]]
    t = Table(rows, colWidths=[70 * mm, 40 * mm])
    t.setStyle(_table_style())
    story.append(t)

    story.append(Paragraph("7. Findings & Recommendations", styles["h1"]))
    findings = []
    if succeeded:
        findings.append(f"<b>{len(succeeded)} attack(s) succeeded</b> in unprotected/baseline rounds — confirm this is the expected control gap the Guardian closes. Inspect attempt IDs: {', '.join(str(a.id) for a in succeeded[:8])}.")
    else:
        findings.append("No attack succeeded under the protected gateway with current scenario set.")
    if fp_attempts:
        findings.append(f"<b>{len(fp_attempts)} legitimate task(s) were blocked</b> — review tuning of thresholds or over-broad rules. Attempt IDs: {', '.join(str(a.id) for a in fp_attempts[:8])}.")
    findings.append("Recommendations: keep mandatory policies (P1, P2, P3, P5, P7, P8) enabled; review approval queues within the 15-minute expiry window; "
                    "rotate canary tokens quarterly; treat all webpage/email/document content as untrusted by default; pair this platform with human red-team review.")
    findings.append("Limitations: synthetic data only; deterministic attack engine (LLM variation is advisory); SQLite is single-writer; "
                    "metrics are sample-size dependent and not a certification of security.")
    for f_ in findings:
        story.append(Paragraph("• " + f_, styles["body"]))
        story.append(Spacer(1, 3))

    story.append(PageBreak())
    story.append(Paragraph("8. Attempt Ledger (persisted evidence)", styles["h1"]))
    rows = [["ID", "Rnd", "Scenario", "Decision", "Risk", "Outcome"]]
    for a in attempts[:60]:
        rows.append([str(a.id), str(a.round_number), a.scenario_code, a.final_decision,
                     str(a.risk_score), a.outcome])
    t = Table(rows, colWidths=[14 * mm, 12 * mm, 34 * mm, 44 * mm, 18 * mm, 38 * mm], repeatRows=1)
    t.setStyle(_table_style())
    story.append(t)

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=1, color=GREY))
    story.append(Paragraph("AGENTSHIELD — fictional data, isolated mock tools, no real systems. SHA-256-bound approvals. "
                           "This document is generated from persisted audit evidence, not agent claims.", styles["small"]))

    doc.build(story)


def _table_style():
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import TableStyle
    NAVY = colors.HexColor("#0b1220")
    CYAN = colors.HexColor("#22d3ee")
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), CYAN),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef6fb")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ])
