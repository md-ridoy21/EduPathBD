#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build-single-text-batch2-recommendations.py <single_text_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:28": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://primeuniversity.edu.bd/",
        "Official Prime University material lists the permanent campus at 114/116 Mazar Road, Mirpur-1, Dhaka-1216."
    ),
    "ugc:private:36": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.easternuni.edu.bd/",
        "Official Eastern University site lists its campus at Ashulia Model Town, Khagan, Birulia, Savar, Dhaka."
    ),
    "ugc:private:37": (
        "RECOMMEND_ACCEPT", "Sylhet", "BD-SYL",
        "https://metrouni.edu.bd/sites/university/contact",
        "Official Metropolitan University contact page lists its permanent campus/mailing address at Bateshwar, Sylhet-3104."
    ),
    "ugc:private:38": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://uttarauniversity.edu.bd/contact-us/",
        "Official Uttara University contact page lists Beribadh Road, Turag, Uttara, Dhaka-1230."
    ),
    "ugc:private:39": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.uiu.ac.bd/contact-us/",
        "Official UIU contact page lists United City, Madani Avenue, Badda, Dhaka-1212."
    ),
    "ugc:private:40": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://southasiauni.ac.bd/",
        "Official University of South Asia site lists its permanent campus at Amin Bazar, Savar, Dhaka-1348."
    ),
    "ugc:private:42": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.bubt.edu.bd/contact",
        "Official BUBT contact page lists Rupnagar, Mirpur-2, Dhaka-1216."
    ),
    "ugc:private:44": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://uits.edu.bd/",
        "Official UITS material lists its permanent campus at Baridhara J Block, Vatara, Dhaka-1212."
    ),
    "ugc:private:45": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://primeasia.edu.bd/contact-us/",
        "Official Primeasia University contact page lists Kemal Ataturk Avenue, Banani, Dhaka."
    ),
    "ugc:private:46": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.royal.edu.bd/contact-us/",
        "Official Royal University of Dhaka contact page lists Plot 404, Tejgaon Industrial Area, Dhaka-1208."
    ),
    "ugc:private:49": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://biu.ac.bd/?page_id=77",
        "Official Bangladesh Islami University contact page lists Green Model Town, Manda, Mugda, Dhaka-1214."
    ),
    "ugc:private:5": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://iubat.edu/contact/",
        "Official IUBAT contact page lists Sector-10, Uttara Model Town, Dhaka-1230."
    ),
    "ugc:private:51": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://www.eastdelta.edu.bd/contact-us",
        "Official East Delta University contact page lists East Nasirabad, Khulshi, Chattogram-4209."
    ),
    "ugc:private:53": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://vu.edu.bd/contact-us",
        "Official Varendra University contact page lists Rajshahi Bypass Road, Chandrima, Paba, Rajshahi-6204."
    ),
    "ugc:private:56": (
        "RECOMMEND_ACCEPT", "Sylhet", "BD-SYL",
        "https://www.neub.edu.bd/",
        "Official North East University Bangladesh material lists Telihaor/Sheikhghat, Sylhet-3100."
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
for row in rows[15:30]:
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
    row["assistant_review_batch"] = "SINGLE_TEXT_BATCH_02"
    selected.append(row)

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in selected))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in selected))
print("needs_more_evidence =", sum(r.get("assistant_location_recommendation") == "NEEDS_MORE_EVIDENCE" for r in selected))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in selected))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in selected))
print("output =", dst)
