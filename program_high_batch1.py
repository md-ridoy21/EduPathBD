#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 program_high_batch1.py <high_quarantine_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

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

selected = []

notes = {
    1: "Admission document requirement; not an academic program.",
    2: "Tuition-fee waiver rule; not an academic program.",
    3: "Tuition-fee page heading/category; not an academic program.",
    4: "Application notice containing an MSN program name; the notice row itself is not the canonical program.",
    5: "Application notice containing a BSc Nursing program name; the notice row itself is not the canonical program.",
    6: "Admission document requirement; not an academic program.",
    7: "Scholarship/waiver rule; not an academic program.",
    8: "Scholarship/waiver rule; not an academic program.",
    9: "Admission document requirement; not an academic program.",
    10: "Identity-document requirement; not an academic program.",
    11: "Certificate/marksheet service action; not an academic program.",
    12: "Tuition-fee structure heading; not an academic program.",
    13: "Tuition-fee structure heading; not an academic program.",
    14: "Tuition-fee structure heading; not an academic program.",
    15: "Admission document/transcript requirement; not an academic program.",
}

for idx, row in enumerate(rows[:15], start=1):
    out = dict(row)
    out["assistant_final_semantic_decision"] = "RECOMMEND_REJECT_AS_NON_PROGRAM"
    out["assistant_final_semantic_note"] = notes[idx]
    out["assistant_review_batch"] = "HIGH_BATCH_01"
    out["human_semantic_decision"] = ""
    selected.append(out)

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_reject_as_non_program =", sum(
    r["assistant_final_semantic_decision"] == "RECOMMEND_REJECT_AS_NON_PROGRAM"
    for r in selected
))
print("human_decisions_changed =", sum(
    bool((r.get("human_semantic_decision") or "").strip())
    for r in selected
))
print("db_changes = false")
print("output =", dst)
