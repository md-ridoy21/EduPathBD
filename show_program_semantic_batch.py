#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) not in (2, 4):
    print("Usage:")
    print("  python3 show_program_semantic_batch.py <csv>")
    print("  python3 show_program_semantic_batch.py <csv> --start <N>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
start = 1

if len(sys.argv) == 4:
    if sys.argv[2] != "--start":
        raise SystemExit("Expected --start")
    start = max(1, int(sys.argv[3]))

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

batch_size = 15
begin = start - 1
end = min(begin + batch_size, len(rows))

print("========================================")
print("PROGRAM SEMANTIC REVIEW BATCH")
print("========================================")
print(f"total_rows = {len(rows)}")
print(f"showing = {begin + 1}-{end}")
print()

for idx, r in enumerate(rows[begin:end], start=begin + 1):
    print("=" * 100)
    print(f"ROW {idx}/{len(rows)}")
    print("Staging ID:", r.get("staging_id", ""))
    print("Parent:", r.get("parent_source_record_id", ""), "|", r.get("institution_name", ""))
    print("Program name:", r.get("program_name", ""))
    print("Degree level:", r.get("degree_level", ""))
    print("Degree award:", r.get("degree_award", ""))
    print("Program source:", r.get("program_source_url", ""))
    print("Severity:", r.get("semantic_audit_severity", ""))
    print("Reasons:", r.get("semantic_audit_reasons", ""))
    print("Assistant recommendation:", r.get("assistant_semantic_recommendation", ""))
    print()

print("========================================")
if end < len(rows):
    print(f"NEXT START = {end + 1}")
else:
    print("END OF QUEUE")
print("NO DATABASE CHANGES MADE")
print("========================================")
