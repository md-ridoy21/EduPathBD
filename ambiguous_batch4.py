#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 ambiguous_batch4.py <ambiguous_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:public:39": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://rmu.edu.bd/contact-us/",
        "Official Rajshahi Medical University contact page lists Laxmipur, Ghoramara, Rajshahi and RMU campus in Rajshahi."
    ),
    "ugc:public:47": (
        "RECOMMEND_ACCEPT", "Chandpur", "BD-CHA",
        "https://www.cstu.ac.bd/contact",
        "Official Chandpur Science and Technology University contact page lists Cumilla Road, Chandpur Sadar, Chandpur-3600."
    ),
    "ugc:public:5": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://www.cu.ac.bd/",
        "Official University of Chittagong academic/contact pages list University of Chittagong, Chattogram-4331."
    ),
    "ugc:public:53": (
        "RECOMMEND_ACCEPT", "Pirojpur", "BD-PIR",
        "https://prstu.ac.bd/",
        "Official Pirojpur Science and Technology University Registrar documents list Pirojpur Sadar-8500."
    ),
    "ugc:public:7": (
        "RECOMMEND_ACCEPT", "Kushtia", "BD-KUS",
        "https://iu.ac.bd/",
        "Official Islamic University contact material lists Islamic University Bangladesh, Kushtia-7003. Khulna in the collector output is highway/context text, not the campus district."
    ),
    "ugc:public:9": (
        "RECOMMEND_ACCEPT", "Khulna", "BD-KHU",
        "https://ku.ac.bd/",
        "Official Khulna University Registrar contact lists Khulna University, Khulna-9208."
    ),
}

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

extra = [
    "assistant_location_recommendation",
    "assistant_recommended_district",
    "assistant_recommended_district_code",
    "assistant_recommendation_source_url",
    "assistant_recommendation_note",
    "assistant_review_batch",
]

for field in extra:
    if field not in fields:
        fields.append(field)

selected = []

for row in rows[36:42]:
    rid = (row.get("parent_source_record_id") or "").strip().lower()
    rec = recommendations.get(rid)
    if not rec:
        continue

    action, district, code, url, note = rec
    row["assistant_location_recommendation"] = action
    row["assistant_recommended_district"] = district
    row["assistant_recommended_district_code"] = code
    row["assistant_recommendation_source_url"] = url
    row["assistant_recommendation_note"] = note
    row["assistant_review_batch"] = "AMBIGUOUS_BATCH_04"
    selected.append(row)

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in selected))
print("recommend_correct_candidate =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_CORRECT_CANDIDATE" for r in selected))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in selected))
print("needs_more_evidence =", sum(r.get("assistant_location_recommendation") == "NEEDS_MORE_EVIDENCE" for r in selected))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in selected))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in selected))
print("output =", dst)
