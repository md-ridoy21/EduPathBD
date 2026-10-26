#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build-structured-location-recommendations.py <structured_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:108": {
        "assistant_location_recommendation": "RECOMMEND_ACCEPT",
        "assistant_recommended_district": "Rangpur",
        "assistant_recommended_district_code": "BD-RNG",
        "assistant_recommendation_source_url": "https://teestauniversity.ac.bd/contact/",
        "assistant_recommendation_note": "Official university contact page lists Modern More, R. K. Road, Rangpur-5404. Other Dhaka text on fetched pages appears unrelated to the university address."
    },
    "ugc:private:47": {
        "assistant_location_recommendation": "RECOMMEND_ACCEPT",
        "assistant_recommended_district": "Dhaka",
        "assistant_recommended_district_code": "BD-DHA",
        "assistant_recommendation_source_url": "https://registrar.ulab.edu.bd/",
        "assistant_recommendation_note": "Official ULAB registrar/contact information lists 688 Beribadh Road, Mohammadpur, Dhaka-1207. Other district mentions are content noise, not address evidence."
    },
    "ugc:private:55": {
        "assistant_location_recommendation": "RECOMMEND_ACCEPT",
        "assistant_recommended_district": "Dhaka",
        "assistant_recommended_district_code": "BD-DHA",
        "assistant_recommendation_source_url": "https://www.buft.edu.bd/",
        "assistant_recommendation_note": "Official BUFT site lists Nishatnagar, Turag, Dhaka-1230."
    },
    "ugc:private:69": {
        "assistant_location_recommendation": "RECOMMEND_ACCEPT",
        "assistant_recommended_district": "Dhaka",
        "assistant_recommended_district_code": "BD-DHA",
        "assistant_recommendation_source_url": "https://ndub.edu.bd/about/contact/",
        "assistant_recommendation_note": "Official NDUB contact page lists 2/A Arambagh, Motijheel, Dhaka 1000."
    },
    "ugc:private:72": {
        "assistant_location_recommendation": "RECOMMEND_ACCEPT",
        "assistant_recommended_district": "Dhaka",
        "assistant_recommended_district_code": "BD-DHA",
        "assistant_recommendation_source_url": "https://fiu.edu.bd/contact-us/",
        "assistant_recommendation_note": "Official FIU contact page identifies the permanent campus at Sector 16/I, Uttara, Dhaka-1230."
    },
    "ugc:private:12": {
        "assistant_location_recommendation": "NEEDS_CAMPUS_POLICY",
        "assistant_recommended_district": "",
        "assistant_recommended_district_code": "",
        "assistant_recommendation_source_url": "https://www.pub.ac.bd/contact-us/",
        "assistant_recommendation_note": "Official contact page lists both Narsingdi Campus and Dhaka Campus. Do not choose a single Institution.district until the project defines whether it stores registered/main/permanent campus district."
    }
}

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    original_fields = list(rows[0].keys()) if rows else []

extra_fields = [
    "assistant_location_recommendation",
    "assistant_recommended_district",
    "assistant_recommended_district_code",
    "assistant_recommendation_source_url",
    "assistant_recommendation_note",
]

fields = original_fields + [f for f in extra_fields if f not in original_fields]

for row in rows:
    rid = (row.get("parent_source_record_id") or "").strip().lower()
    rec = recommendations.get(rid)
    if rec:
        row.update(rec)
    else:
        for field in extra_fields:
            row.setdefault(field, "")

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

print("rows =", len(rows))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in rows))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in rows))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in rows))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in rows))
print("output =", dst)
