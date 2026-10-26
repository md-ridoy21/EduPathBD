#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 split_program_semantic_flags.py <program_semantic_flags.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

high = [r for r in rows if (r.get("semantic_audit_severity") or "").strip() == "HIGH"]
medium = [r for r in rows if (r.get("semantic_audit_severity") or "").strip() == "MEDIUM"]
other = [
    r for r in rows
    if (r.get("semantic_audit_severity") or "").strip() not in {"HIGH", "MEDIUM"}
]

high_path = out_dir / "program_semantic_high_quarantine_candidates.csv"
medium_path = out_dir / "program_semantic_medium_manual_review.csv"
manifest_path = out_dir / "PROGRAM_SEMANTIC_SPLIT_MANIFEST.json"

for path, data in [(high_path, high), (medium_path, medium)]:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(data)

checks = {
    "expected_total_104": len(rows) == 104,
    "expected_high_47": len(high) == 47,
    "expected_medium_57": len(medium) == 57,
    "no_other_severity": len(other) == 0,
    "partition_reconstructs_input": len(high) + len(medium) == len(rows),
    "high_are_recommend_reject": all(
        (r.get("assistant_semantic_recommendation") or "").strip()
        == "RECOMMEND_REJECT_AS_NON_PROGRAM"
        for r in high
    ),
    "medium_are_manual_review": all(
        (r.get("assistant_semantic_recommendation") or "").strip()
        == "NEEDS_MANUAL_REVIEW"
        for r in medium
    ),
}

hard_stops = [k for k, v in checks.items() if not v]

manifest = {
    "status": "PASS_PROGRAM_SEMANTIC_FLAG_SPLIT" if not hard_stops else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputFlaggedRows": len(rows),
    "highQuarantineCandidates": len(high),
    "mediumManualReviewRows": len(medium),
    "otherSeverityRows": len(other),
    "humanDecisionsChanged": 0,
    "autoDeletePerformed": False,
    "autoRejectPerformed": False,
    "checks": checks,
    "hardStopReasons": hard_stops,
    "files": {
        "high": high_path.name,
        "medium": medium_path.name,
    },
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("PROGRAM SEMANTIC FLAG SPLIT")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(high_path)
print(medium_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stops:
    raise SystemExit(2)
