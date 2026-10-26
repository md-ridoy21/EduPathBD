#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path
from collections import Counter

if len(sys.argv) != 3:
    print("Usage: python3 merge_location_reviews_v2.py <review-dir> <evidence.csv>")
    raise SystemExit(2)

review_dir = Path(sys.argv[1]).expanduser().resolve()
evidence_path = Path(sys.argv[2]).expanduser().resolve()

files = [
    review_dir / "structured_address_assistant_recommendations.csv",
    review_dir / "single_text_batch01_assistant_recommendations.csv",
    review_dir / "single_text_batch02_assistant_recommendations.csv",
    review_dir / "single_text_batch03_assistant_recommendations.csv",
    review_dir / "single_text_batch04_assistant_recommendations.csv",
    review_dir / "ambiguous_batch01_assistant_recommendations.csv",
    review_dir / "ambiguous_batch02_assistant_recommendations.csv",
    review_dir / "ambiguous_batch03_assistant_recommendations.csv",
    review_dir / "ambiguous_batch04_assistant_recommendations.csv",
]

missing = [str(p) for p in files if not p.exists()]
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

recommendations = []
for path in files:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        recommendations.extend(csv.DictReader(f))

ids = [norm_id(r.get("parent_source_record_id")) for r in recommendations]
id_counts = Counter(ids)
duplicates = sorted(k for k, v in id_counts.items() if k and v > 1)

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
hold_rows = [
    r for r in reviewed
    if clean(r.get("assistant_location_recommendation")) == "NEEDS_CAMPUS_POLICY"
]

accept_missing_code = [
    r for r in accept_rows
    if not clean(r.get("assistant_recommended_district_code"))
]

correction_with_code = [
    r for r in correction_rows
    if clean(r.get("assistant_recommended_district_code"))
]

hold_with_location = [
    r for r in hold_rows
    if clean(r.get("assistant_recommended_district"))
    or clean(r.get("assistant_recommended_district_code"))
]

master_path = review_dir / "ugc_parent_location_reconciliation_master_v2.csv"
reviewed_path = review_dir / "ugc_parent_location_assistant_reviewed_v2.csv"
unreviewed_path = review_dir / "ugc_parent_location_unreviewed_v2.csv"
summary_path = review_dir / "ugc_parent_location_reconciliation_summary_v2.json"

for path, data in [
    (master_path, merged),
    (reviewed_path, reviewed),
    (unreviewed_path, unreviewed),
]:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader()
        w.writerows(data)

summary = {
    "evidence_rows": len(evidence),
    "recommendation_rows_loaded": len(recommendations),
    "unique_recommendation_ids": len(set(ids)),
    "duplicate_recommendation_ids": len(duplicates),
    "duplicate_ids": duplicates,
    "reviewed_rows": len(reviewed),
    "unreviewed_rows": len(unreviewed),
    "recommend_accept": action_counts.get("RECOMMEND_ACCEPT", 0),
    "recommend_correct_candidate": action_counts.get("RECOMMEND_CORRECT_CANDIDATE", 0),
    "needs_campus_policy": action_counts.get("NEEDS_CAMPUS_POLICY", 0),
    "needs_more_evidence": action_counts.get("NEEDS_MORE_EVIDENCE", 0),
    "unreviewed_evidence_type_counts": dict(Counter(
        clean(r.get("evidence_type")) or "<blank>"
        for r in unreviewed
    )),
    "unreviewed_fetch_status_counts": dict(Counter(
        clean(r.get("fetch_status")) or "<blank>"
        for r in unreviewed
    )),
    "human_decisions_nonblank": len(human_nonblank),
    "accepted_district_nonblank": len(accepted_nonblank),
    "accepted_district_code_nonblank": len(accepted_code_nonblank),
    "accept_rows_missing_code": len(accept_missing_code),
    "correction_rows_with_code": len(correction_with_code),
    "campus_policy_rows_with_location": len(hold_with_location),
    "db_changes": False,
}

summary_path.write_text(
    json.dumps(summary, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("UGC LOCATION RECONCILIATION V2")
print("========================================")
print(json.dumps(summary, indent=2, ensure_ascii=False))
print()
print("FILES")
print(master_path)
print(reviewed_path)
print(unreviewed_path)
print(summary_path)
print()
print("NO DATABASE CHANGES MADE")
