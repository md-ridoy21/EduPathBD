#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build-single-text-batch3-recommendations.py <single_text_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:58": (
        "RECOMMEND_CORRECT_CANDIDATE", "Kishoreganj", "",
        "https://www.ishakha.edu.bd/en/contact/",
        "Collector candidate Mymensingh is not the university district. Official IIUB contact page lists Nilganj Road, 461 Sholakia Road, Kishoreganj-2300. Leave district code blank until the exact local District.code is read from EduPath DB."
    ),
    "ugc:private:6": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://www.iiuc.ac.bd/web/about/contact",
        "Official IIUC contact page lists Kumira, Chattogram-4318."
    ),
    "ugc:private:63": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.su.edu.bd/contact",
        "Official Sonargaon University contact material lists Green Road and Mohakhali campuses in Dhaka; its permanent campus is also listed in Dhaka."
    ),
    "ugc:private:66": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://www.portcity.edu.bd/HomePage/SubPageDetailsPara/12/Page/contact",
        "Official PCIU contact page lists both current and permanent campuses in Chattogram."
    ),
    "ugc:private:7": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.aust.edu/contact",
        "Official AUST contact page lists 141 & 142 Love Road, Tejgaon Industrial Area, Dhaka-1208."
    ),
    "ugc:private:78": (
        "RECOMMEND_ACCEPT", "Barishal", "BD-BSL",
        "https://globaluniversity.edu.bd/",
        "Official Global University Bangladesh material identifies the university as located in Barishal."
    ),
    "ugc:private:80": (
        "RECOMMEND_CORRECT_CANDIDATE", "Nilphamari", "",
        "https://www.baust.edu.bd/",
        "Collector candidate Rangpur is caused by unrelated Rangpur-area text. Official BAUST site lists Saidpur Cantonment, Saidpur; government procurement records identify Saidpur Cantonment Board under Nilphamari district. Leave district code blank until the exact local District.code is read from EduPath DB."
    ),
    "ugc:private:83": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://ius.edu.bd/contact-us",
        "Official University of Scholars contact page lists its main campus at Banani, Dhaka-1213."
    ),
    "ugc:private:84": (
        "NEEDS_CAMPUS_POLICY", "", "",
        "https://www.cub.edu.bd/",
        "Official CUB material lists a city campus in Dhaka and a permanent campus in Purbachal New Town. Do not collapse to one Institution.district until the project defines which campus type the singular district field represents."
    ),
    "ugc:private:87": (
        "RECOMMEND_ACCEPT", "Kushtia", "BD-KUS",
        "https://rmu.ac.bd/contact/",
        "Official Rabindra Maitree University contact page lists Courtpara, Kushtia-7000."
    ),
    "ugc:private:89": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://cust.ac.bd/",
        "Official CUST site lists Plot 1/9, Road 2, Block D, Section 15, Mirpur, Dhaka-1216."
    ),
    "ugc:private:9": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://ewubd.edu/",
        "Official East West University site lists Aftabnagar, Dhaka-1212."
    ),
    "ugc:private:90": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://tuca.edu.bd/",
        "Official TUCA site lists Sector 12, Uttara, Dhaka-1230."
    ),
    "ugc:public:1": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.du.ac.bd/contactus",
        "Official University of Dhaka contact page lists Administrative Building, Dhaka-1000."
    ),
    "ugc:public:12": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.bmu.ac.bd/contact",
        "Official Bangladesh Medical University contact page lists Shahbag, Dhaka-1000."
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

for row in rows[30:45]:
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
    row["assistant_review_batch"] = "SINGLE_TEXT_BATCH_03"

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
