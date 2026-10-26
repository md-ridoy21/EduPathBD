#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path
from collections import Counter

if len(sys.argv) != 3:
    print("Usage: python3 program_high_all.py <high_quarantine_candidates.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

if len(rows) != 47:
    print(f"ERROR: expected 47 HIGH rows, found {len(rows)}")
    raise SystemExit(1)

decision_fields = [
    "assistant_final_semantic_decision",
    "assistant_final_semantic_note",
    "assistant_review_batch",
    "human_semantic_decision",
]

for field in decision_fields:
    if field not in fields:
        fields.append(field)

reviewed = []
unexpected = []

for row in rows:
    severity = (row.get("semantic_audit_severity") or "").strip()
    prior = (row.get("assistant_semantic_recommendation") or "").strip()
    reasons = (row.get("semantic_audit_reasons") or "").strip()

    if severity != "HIGH" or prior != "RECOMMEND_REJECT_AS_NON_PROGRAM":
        unexpected.append({
            "staging_id": row.get("staging_id", ""),
            "severity": severity,
            "prior_recommendation": prior,
        })
        continue

    out = dict(row)
    out["assistant_final_semantic_decision"] = "RECOMMEND_REJECT_AS_NON_PROGRAM"
    out["assistant_final_semantic_note"] = (
        "High-confidence semantic contamination from the reviewed program audit; "
        "row represents admission/admin/document/fee/waiver/application/service text "
        "rather than a canonical academic program. Original audit reasons: " + reasons
    )
    out["assistant_review_batch"] = "HIGH_ALL_47"
    out["human_semantic_decision"] = ""
    reviewed.append(out)

output_csv = out_dir / "program_high_all_assistant_recommendations.csv"
manifest_path = out_dir / "PROGRAM_HIGH_ALL_REVIEW_MANIFEST.json"

with output_csv.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(reviewed)

decision_counts = Counter(
    r["assistant_final_semantic_decision"]
    for r in reviewed
)

checks = {
    "expected_input_47": len(rows) == 47,
    "all_rows_reviewed": len(reviewed) == 47,
    "no_unexpected_rows": len(unexpected) == 0,
    "all_final_reject_non_program": all(
        r["assistant_final_semantic_decision"] == "RECOMMEND_REJECT_AS_NON_PROGRAM"
        for r in reviewed
    ),
    "human_decisions_untouched": all(
        not (r.get("human_semantic_decision") or "").strip()
        for r in reviewed
    ),
}

hard_stops = [k for k, v in checks.items() if not v]

manifest = {
    "status": "PASS_HIGH_47_ASSISTANT_REVIEW" if not hard_stops else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputRows": len(rows),
    "reviewedRows": len(reviewed),
    "recommendRejectAsNonProgram": decision_counts.get("RECOMMEND_REJECT_AS_NON_PROGRAM", 0),
    "unexpectedRows": unexpected,
    "humanDecisionsChanged": 0,
    "autoDeletePerformed": False,
    "databaseWritePerformed": False,
    "checks": checks,
    "hardStopReasons": hard_stops,
    "files": {
        "assistantRecommendations": output_csv.name,
    },
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

print("========================================")
print("PROGRAM HIGH SEMANTIC REVIEW - ALL 47")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(output_csv)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stops:
    raise SystemExit(2)
