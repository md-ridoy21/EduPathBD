#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build-single-text-batch4-recommendations.py <single_text_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:public:3": (
        "RECOMMEND_ACCEPT", "Mymensingh", "BD-MYM",
        "https://www.bau.edu.bd/contact",
        "Official Bangladesh Agricultural University contact page lists Mymensingh-2202."
    ),
    "ugc:public:36": (
        "NEEDS_CAMPUS_POLICY", "", "",
        "https://bmu.edu.bd/contact",
        "Bangladesh Maritime University currently operates from a temporary campus in Mirpur, Dhaka, while its permanent campus is at Hamidchar, Chattogram. Do not collapse these to one Institution.district until campus-location policy is defined."
    ),
    "ugc:public:38": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://www.cmu.edu.bd/",
        "Official Chittagong Medical University material identifies the university in Chattogram; official examination-office documents list Fouzderhat, Chattogram."
    ),
    "ugc:public:42": (
        "RECOMMEND_ACCEPT", "Netrokona", "BD-NET",
        "https://neu.ac.bd/contact-us/",
        "Official Netrokona University contact/admission material lists its temporary campus in Netrokona, while official permanent-campus notices also identify Netrokona."
    ),
    "ugc:public:46": (
        "NEEDS_CAMPUS_POLICY", "", "",
        "https://www.event.aaub.edu.bd/index.html",
        "Official AAUB material lists both Dhaka Campus at Old Airport, Tejgaon, Dhaka and Lalmonirhat Campus at Airport Road, Mahendranagar, Lalmonirhat. Do not select one singular district without a campus-location policy."
    ),
    "ugc:public:6": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://juniv.edu/page/contact-us",
        "Official Jahangirnagar University contact page lists Savar, Dhaka-1342."
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

for row in rows[45:51]:
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
    row["assistant_review_batch"] = "SINGLE_TEXT_BATCH_04"
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
