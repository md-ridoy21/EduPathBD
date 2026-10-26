#!/usr/bin/env python3
import csv
import json
import sys
from collections import Counter
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 finalize_location_reconciliation.py <review-dir> <evidence.csv>")
    raise SystemExit(2)

review_dir = Path(sys.argv[1]).expanduser().resolve()
evidence_path = Path(sys.argv[2]).expanduser().resolve()

source_files = [
    review_dir / "structured_address_assistant_recommendations.csv",
    review_dir / "single_text_batch01_assistant_recommendations.csv",
    review_dir / "single_text_batch02_assistant_recommendations.csv",
    review_dir / "single_text_batch03_assistant_recommendations.csv",
    review_dir / "single_text_batch04_assistant_recommendations.csv",
    review_dir / "ambiguous_batch01_assistant_recommendations.csv",
    review_dir / "ambiguous_batch02_assistant_recommendations.csv",
    review_dir / "ambiguous_batch03_assistant_recommendations.csv",
    review_dir / "ambiguous_batch04_assistant_recommendations.csv",
    review_dir / "none_batch01_assistant_recommendations.csv",
    review_dir / "none_batch02_assistant_recommendations.csv",
]

missing = [str(p) for p in source_files if not p.exists()]
if missing:
    print("ERROR: missing recommendation files:")
    for p in missing:
        print(" -", p)
    raise SystemExit(1)

if not evidence_path.exists():
    print("ERROR: evidence file missing:", evidence_path)
    raise SystemExit(1)

def clean(v):
    return (v or "").strip()

def norm_id(v):
    return clean(v).lower()

# Load all recommendations.
recommendations = []
for path in source_files:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        recommendations.extend(csv.DictReader(f))

# Resolve the one exact code lookup using the read-only DB result supplied by the user.
for row in recommendations:
    if norm_id(row.get("parent_source_record_id")) == "ugc:private:60":
        assert clean(row.get("assistant_recommended_district")) == "Chapainawabganj"
        row["assistant_recommended_district_code"] = "BD-CHP"
        if clean(row.get("assistant_location_recommendation")) == "RECOMMEND_ACCEPT_NEEDS_CODE_LOOKUP":
            row["assistant_location_recommendation"] = "RECOMMEND_ACCEPT"
        note = clean(row.get("assistant_recommendation_note"))
        suffix = (
            " Exact EduPath District.code resolved by read-only Prisma lookup: "
            "district_chapainawabganj / BD-CHP."
        )
        if suffix.strip() not in note:
            row["assistant_recommendation_note"] = note + suffix

# Preserve a resolved copy of none batch 2; do not overwrite the original evidence/recommendation file.
resolved_none2 = review_dir / "none_batch02_assistant_recommendations_resolved.csv"
none2_rows = [
    r for r in recommendations
    if clean(r.get("assistant_review_batch")) == "NONE_BATCH_02"
]

none2_fields = list(none2_rows[0].keys()) if none2_rows else []
with resolved_none2.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=none2_fields)
    w.writeheader()
    w.writerows(none2_rows)

ids = [norm_id(r.get("parent_source_record_id")) for r in recommendations]
id_counts = Counter(ids)
duplicate_ids = sorted(k for k, v in id_counts.items() if k and v > 1)

with evidence_path.open("r", encoding="utf-8-sig", newline="") as f:
    evidence = list(csv.DictReader(f))

recommendation_by_id = {
    norm_id(r.get("parent_source_record_id")): r
    for r in recommendations
}

assistant_fields = [
    "assistant_location_recommendation",
    "assistant_recommended_district",
    "assistant_recommended_district_code",
    "assistant_recommendation_source_url",
    "assistant_recommendation_note",
    "assistant_review_batch",
]

base_fields = list(evidence[0].keys()) if evidence else []
out_fields = base_fields + [f for f in assistant_fields if f not in base_fields]

merged = []
for row in evidence:
    rid = norm_id(row.get("parent_source_record_id"))
    rec = recommendation_by_id.get(rid)

    out = dict(row)
    for field in assistant_fields:
        out[field] = clean(rec.get(field)) if rec else ""
    merged.append(out)

reviewed = [r for r in merged if clean(r.get("assistant_location_recommendation"))]
unreviewed = [r for r in merged if not clean(r.get("assistant_location_recommendation"))]

action_counts = Counter(
    clean(r.get("assistant_location_recommendation"))
    for r in reviewed
)

human_nonblank = [r for r in merged if clean(r.get("human_decision"))]
accepted_nonblank = [r for r in merged if clean(r.get("accepted_district"))]
accepted_code_nonblank = [r for r in merged if clean(r.get("accepted_district_code"))]

accept_rows = [
    r for r in reviewed
    if clean(r.get("assistant_location_recommendation")) == "RECOMMEND_ACCEPT"
]
correction_rows = [
    r for r in reviewed
    if clean(r.get("assistant_location_recommendation")) == "RECOMMEND_CORRECT_CANDIDATE"
]
campus_rows = [
    r for r in reviewed
    if clean(r.get("assistant_location_recommendation")) == "NEEDS_CAMPUS_POLICY"
]
model_rows = [
    r for r in reviewed
    if clean(r.get("assistant_location_recommendation")) == "NEEDS_MODEL_POLICY"
]

accept_missing_code = [
    r for r in accept_rows
    if not clean(r.get("assistant_recommended_district_code"))
]
correction_with_code = [
    r for r in correction_rows
    if clean(r.get("assistant_recommended_district_code"))
]
campus_with_location = [
    r for r in campus_rows
    if clean(r.get("assistant_recommended_district"))
    or clean(r.get("assistant_recommended_district_code"))
]
model_with_location = [
    r for r in model_rows
    if clean(r.get("assistant_recommended_district"))
    or clean(r.get("assistant_recommended_district_code"))
]

master_path = review_dir / "ugc_parent_location_reconciliation_final.csv"
summary_path = review_dir / "ugc_parent_location_reconciliation_final_summary.json"
ready_path = review_dir / "ugc_parent_location_district_ready.csv"
hold_path = review_dir / "ugc_parent_location_policy_holds.csv"
correction_path = review_dir / "ugc_parent_location_corrected_candidates.csv"

ready_rows = accept_rows
hold_rows = campus_rows + model_rows

for path, data in [
    (master_path, merged),
    (ready_path, ready_rows),
    (hold_path, hold_rows),
    (correction_path, correction_rows),
]:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader()
        w.writerows(data)

summary = {
    "status": "PASS_FINAL_LOCATION_RECONCILIATION",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbWritesPerformed": False,
    "evidence_rows": len(evidence),
    "recommendation_rows_loaded": len(recommendations),
    "unique_recommendation_ids": len(set(ids)),
    "duplicate_recommendation_ids": len(duplicate_ids),
    "duplicate_ids": duplicate_ids,
    "reviewed_rows": len(reviewed),
    "unreviewed_rows": len(unreviewed),
    "recommend_accept": action_counts.get("RECOMMEND_ACCEPT", 0),
    "recommend_correct_candidate": action_counts.get("RECOMMEND_CORRECT_CANDIDATE", 0),
    "needs_campus_policy": action_counts.get("NEEDS_CAMPUS_POLICY", 0),
    "needs_model_policy": action_counts.get("NEEDS_MODEL_POLICY", 0),
    "needs_more_evidence": action_counts.get("NEEDS_MORE_EVIDENCE", 0),
    "human_decisions_nonblank": len(human_nonblank),
    "accepted_district_nonblank": len(accepted_nonblank),
    "accepted_district_code_nonblank": len(accepted_code_nonblank),
    "accept_rows_missing_code": len(accept_missing_code),
    "correction_rows_with_code": len(correction_with_code),
    "campus_policy_rows_with_location": len(campus_with_location),
    "model_policy_rows_with_location": len(model_with_location),
    "district_ready_rows": len(ready_rows),
    "policy_hold_rows": len(hold_rows),
    "corrected_candidate_rows": len(correction_rows),
    "chapainawabganj_resolution": {
        "institution_id": "ugc:private:60",
        "district_id": "district_chapainawabganj",
        "district_code": "BD-CHP",
        "source": "read-only Prisma lookup",
    },
}

summary_path.write_text(
    json.dumps(summary, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("FINAL UGC LOCATION RECONCILIATION")
print("========================================")
print(json.dumps(summary, indent=2, ensure_ascii=False))
print()
print("FILES")
print(master_path)
print(ready_path)
print(hold_path)
print(correction_path)
print(resolved_none2)
print(summary_path)
print()
print("NO DATABASE CHANGES MADE")
