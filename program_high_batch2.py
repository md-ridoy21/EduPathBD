#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 program_high_batch2.py <high_quarantine_candidates.csv> <output.csv>")
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

notes = {
    16: "Admission transcript/certificate requirement; not an academic program.",
    17: "Admission transcript/certificate requirement; not an academic program.",
    18: "Transcript/certificate request service; not an academic program.",
    19: "Certificate/transcript service label; not an academic program.",
    20: "Admission document requirement; not an academic program.",
    21: "Admission identity-document requirement; not an academic program.",
    22: "Admission identity-document requirement; not an academic program.",
    23: "Application-form link containing an MSc Physics program name; the link row itself is not the canonical program.",
    24: "Admission identity-document requirement; not an academic program.",
    25: "Admission identity-document requirement; not an academic program.",
    26: "Administrative application/service list for certificates and records; not an academic program.",
    27: "Certificate/transcript/migration service label; not an academic program.",
    28: "Document verification service; not an academic program.",
    29: "Admission identity-document requirement; not an academic program.",
    30: "Certificate/marksheet service action; not an academic program.",
}

selected = []

for idx in range(16, 31):
    row = rows[idx - 1]
    out = dict(row)
    out["assistant_final_semantic_decision"] = "RECOMMEND_REJECT_AS_NON_PROGRAM"
    out["assistant_final_semantic_note"] = notes[idx]
    out["assistant_review_batch"] = "HIGH_BATCH_02"
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
