#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 ambiguous_batch3.py <ambiguous_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:public:14": (
        "RECOMMEND_ACCEPT", "Dinajpur", "BD-DIN",
        "https://hstu.ac.bd/about_us/contact_us",
        "Official HSTU contact page lists Basherhat, Dhaka-Dinajpur Highway, Dinajpur-5200. Dhaka is part of the highway name, not the campus district."
    ),
    "ugc:public:16": (
        "RECOMMEND_ACCEPT", "Patuakhali", "BD-PAT",
        "https://pstu.ac.bd/",
        "Official PSTU site lists Dumki-8602, Dumki, Patuakhali."
    ),
    "ugc:public:17": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.sau.edu.bd/contact",
        "Official Sher-e-Bangla Agricultural University contact page lists Sher-e-Bangla Nagar, Dhaka-1207."
    ),
    "ugc:public:19": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://www.ruet.ac.bd/",
        "Official RUET site lists Kazla, Rajshahi-6204."
    ),
    "ugc:public:2": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://www.ru.ac.bd/",
        "University of Rajshahi is located in Rajshahi; the collector's Dhaka mention is historical/contextual text."
    ),
    "ugc:public:20": (
        "RECOMMEND_ACCEPT", "Khulna", "BD-KHU",
        "https://www.kuet.ac.bd/",
        "Official KUET units consistently list Khulna University of Engineering & Technology, Khulna-9203."
    ),
    "ugc:public:21": (
        "RECOMMEND_ACCEPT", "Gazipur", "BD-GAZ",
        "https://duet.ac.bd/office/registrar-office/contact-us",
        "Official DUET Registrar Office lists DUET, Gazipur, Gazipur-1707."
    ),
    "ugc:public:23": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.jnu.ac.bd/",
        "Official Jagannath University site lists 9-10 Chittaranjan Avenue, Dhaka-1100."
    ),
    "ugc:public:24": (
        "RECOMMEND_ACCEPT", "Cumilla", "BD-COM",
        "https://www.cou.ac.bd/contact-us",
        "Official Comilla University material identifies the university at Kotbari, Cumilla."
    ),
    "ugc:public:31": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.bup.edu.bd/contact",
        "Official BUP contact page lists Mirpur Cantonment, Dhaka-1216."
    ),
    "ugc:public:32": (
        "RECOMMEND_ACCEPT", "Gopalganj", "BD-GOP",
        "https://www.gstu.edu.bd/dev/contact/",
        "Official GSTU contact page lists Gopalganj Science & Technology University, Gopalganj-8100. The trailing 'Dhaka, Bangladesh' is broader geographic/postal context, not the district."
    ),
    "ugc:public:33": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.butex.edu.bd/contact-us/",
        "Official BUTEX contact page lists 92 Shaheed Tajuddin Ahmed Avenue, Tejgaon Industrial Area, Dhaka-1208."
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

for row in rows[24:36]:
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
    row["assistant_review_batch"] = "AMBIGUOUS_BATCH_03"
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
