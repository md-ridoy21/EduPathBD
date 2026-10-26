#!/usr/bin/env python3
import csv
import json
import sys
from collections import Counter
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 split_programs_by_parent_policy.py <program_draft_ready.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

BLOCKED = {
    "ugc:international:3": "NEEDS_MODEL_POLICY",
    "ugc:private:12": "NEEDS_CAMPUS_POLICY",
    "ugc:private:100": "NEEDS_CAMPUS_POLICY",
    "ugc:private:77": "NEEDS_CAMPUS_POLICY",
    "ugc:private:84": "NEEDS_CAMPUS_POLICY",
    "ugc:public:36": "NEEDS_CAMPUS_POLICY",
    "ugc:public:46": "NEEDS_CAMPUS_POLICY",
}

EXPECTED_BLOCKED_COUNTS = {
    "ugc:international:3": 19,
    "ugc:private:100": 4,
    "ugc:private:12": 2,
    "ugc:private:77": 14,
    "ugc:private:84": 15,
    "ugc:public:36": 1,
    "ugc:public:46": 11,
}

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

if len(rows) != 1608:
    print(f"ERROR: expected 1608 input rows, found {len(rows)}")
    raise SystemExit(1)

parent_field = "parent_source_record_id"
if parent_field not in fields:
    print(f"ERROR: missing required column: {parent_field}")
    raise SystemExit(1)

resolved = []
blocked = []

for row in rows:
    rid = (row.get(parent_field) or "").strip().lower()
    if rid in BLOCKED:
        out = dict(row)
        out["policy_hold_reason"] = BLOCKED[rid]
        blocked.append(out)
    else:
        resolved.append(row)

blocked_counts = Counter(
    (r.get(parent_field) or "").strip().lower()
    for r in blocked
)

unexpected_blocked_ids = sorted(set(blocked_counts) - set(BLOCKED))
missing_expected_ids = sorted(set(BLOCKED) - set(blocked_counts))

count_mismatches = {
    rid: {
        "expected": expected,
        "actual": blocked_counts.get(rid, 0),
    }
    for rid, expected in EXPECTED_BLOCKED_COUNTS.items()
    if blocked_counts.get(rid, 0) != expected
}

resolved_path = out_dir / "program_resolved_parent_draft_ready.csv"
blocked_path = out_dir / "program_policy_blocked.csv"
manifest_path = out_dir / "PROGRAM_PARENT_POLICY_SPLIT_MANIFEST.json"

with resolved_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(resolved)

blocked_fields = fields + ["policy_hold_reason"]
with blocked_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=blocked_fields)
    w.writeheader()
    w.writerows(blocked)

checks = {
    "expected_input_1608": len(rows) == 1608,
    "expected_resolved_1542": len(resolved) == 1542,
    "expected_blocked_66": len(blocked) == 66,
    "no_unexpected_blocked_ids": len(unexpected_blocked_ids) == 0,
    "no_missing_expected_blocked_ids": len(missing_expected_ids) == 0,
    "blocked_counts_match_expected": len(count_mismatches) == 0,
    "partition_reconstructs_input": len(resolved) + len(blocked) == len(rows),
}

hard_stops = [k for k, v in checks.items() if not v]

manifest = {
    "status": "PASS_PROGRAM_PARENT_POLICY_SPLIT" if not hard_stops else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputRows": len(rows),
    "resolvedParentRows": len(resolved),
    "policyBlockedRows": len(blocked),
    "blockedParentCount": len(BLOCKED),
    "blockedParentRows": dict(sorted(blocked_counts.items())),
    "unexpectedBlockedIds": unexpected_blocked_ids,
    "missingExpectedBlockedIds": missing_expected_ids,
    "countMismatches": count_mismatches,
    "checks": checks,
    "hardStopReasons": hard_stops,
    "files": {
        "resolvedParentDraftReady": resolved_path.name,
        "policyBlocked": blocked_path.name,
    },
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("UGC PROGRAM PARENT POLICY SPLIT")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(resolved_path)
print(blocked_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stops:
    raise SystemExit(2)
