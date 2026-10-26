#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path
from collections import Counter

if len(sys.argv) != 3:
    print("Usage: python3 review-ugc-location-evidence.py <evidence.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out = Path(sys.argv[2]).expanduser().resolve()
out.mkdir(parents=True, exist_ok=True)

if not src.exists():
    print(f"ERROR: input not found: {src}")
    raise SystemExit(1)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

def clean(v):
    return (v or "").strip()

buckets = {
    "structured_address_candidates.csv": [],
    "single_text_candidates.csv": [],
    "ambiguous_candidates.csv": [],
    "no_evidence_or_failed.csv": [],
}

for r in rows:
    et = clean(r.get("evidence_type"))
    fetch = clean(r.get("fetch_status"))

    if et == "STRUCTURED_ADDRESS_CANDIDATE":
        buckets["structured_address_candidates.csv"].append(r)
    elif et == "SINGLE_TEXT_MENTION_CANDIDATE":
        buckets["single_text_candidates.csv"].append(r)
    elif et == "AMBIGUOUS_MULTIPLE_DISTRICTS":
        buckets["ambiguous_candidates.csv"].append(r)
    else:
        buckets["no_evidence_or_failed.csv"].append(r)

headers = list(rows[0].keys()) if rows else []

for name, data in buckets.items():
    with (out / name).open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        w.writerows(data)

summary = {
    "rows": len(rows),
    "fetch_status": dict(Counter(clean(r.get("fetch_status")) for r in rows)),
    "evidence_type": dict(Counter(clean(r.get("evidence_type")) for r in rows)),
    "candidate_count": dict(Counter(clean(r.get("candidate_count")) for r in rows)),
    "human_decisions_nonblank": sum(bool(clean(r.get("human_decision"))) for r in rows),
    "accepted_district_nonblank": sum(bool(clean(r.get("accepted_district"))) for r in rows),
    "accepted_district_code_nonblank": sum(bool(clean(r.get("accepted_district_code"))) for r in rows),
    "queues": {k: len(v) for k, v in buckets.items()},
    "db_changes": False,
}

(out / "review_queue_summary.json").write_text(
    json.dumps(summary, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("UGC LOCATION REVIEW QUEUE")
print("========================================")
print(json.dumps(summary, indent=2, ensure_ascii=False))

print()
print("========================================")
print("STRUCTURED ADDRESS CANDIDATES")
print("========================================")

for r in buckets["structured_address_candidates.csv"]:
    print()
    print("ID:", clean(r.get("parent_source_record_id")))
    print("Institution:", clean(r.get("canonical_name")))
    print("Website:", clean(r.get("fetched_url")))
    print("Structured address:", clean(r.get("structured_address")))
    print("District candidates:", clean(r.get("district_candidates")))
    print("Evidence excerpt:", clean(r.get("evidence_excerpt")))
    print("Decision fields:",
          clean(r.get("human_decision")) or "<blank>",
          "|",
          clean(r.get("accepted_district_code")) or "<blank>")

print()
print("NO DATABASE CHANGES MADE")
