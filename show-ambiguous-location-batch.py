#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) not in (2, 4):
    print("Usage:")
    print("  python3 show-ambiguous-location-batch.py <ambiguous_candidates.csv>")
    print("  python3 show-ambiguous-location-batch.py <ambiguous_candidates.csv> --start <N>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
start = 1

if len(sys.argv) == 4:
    if sys.argv[2] != "--start":
        print("ERROR: expected --start")
        raise SystemExit(2)
    start = max(1, int(sys.argv[3]))

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

batch_size = 12
begin = start - 1
end = min(begin + batch_size, len(rows))
batch = rows[begin:end]

print("========================================")
print("AMBIGUOUS LOCATION REVIEW BATCH")
print("========================================")
print(f"total_rows = {len(rows)}")
print(f"showing = {begin + 1}-{end}")
print()

for idx, r in enumerate(batch, start=begin + 1):
    print("=" * 100)
    print(f"ROW {idx}/{len(rows)}")
    print("ID:", (r.get("parent_source_record_id") or "").strip())
    print("Institution:", (r.get("canonical_name") or "").strip())
    print("Category:", (r.get("category") or "").strip())
    print("Official website raw:", (r.get("official_website_raw") or "").strip())
    print("Fetched URL:", (r.get("fetched_url") or "").strip())
    print("Structured address:", (r.get("structured_address") or "").strip())
    print("District candidates:", (r.get("district_candidates") or "").strip())
    print("Candidate count:", (r.get("candidate_count") or "").strip())
    print("Evidence excerpt:", (r.get("evidence_excerpt") or "").strip())
    print("Identity source URL:", (r.get("identity_source_url") or "").strip())
    print("Human decision:", (r.get("human_decision") or "").strip() or "<blank>")
    print("Accepted district code:", (r.get("accepted_district_code") or "").strip() or "<blank>")
    print()

print("========================================")
if end < len(rows):
    print(f"NEXT START = {end + 1}")
else:
    print("END OF QUEUE")
print("NO DATABASE CHANGES MADE")
print("========================================")
