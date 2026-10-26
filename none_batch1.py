#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 none_batch1.py <unreviewed_v2.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:international:3": (
        "NEEDS_MODEL_POLICY", "", "",
        "https://sau.int/admission-faqs/",
        "Official South Asian University source places the university at Maidan Garhi, New Delhi, India, and states there are no regional campuses. Current EduPath Institution requires a Bangladesh district, so no district may be assigned without changing the data model/policy."
    ),
    "ugc:private:111": (
        "RECOMMEND_ACCEPT", "Kushtia", "BD-KUS",
        "https://jazsstu.ac/contact",
        "Official Justice Abu Zafar Siddiquie Science and Technology University contact page lists Kumarkhali, Kushtia-7010."
    ),
    "ugc:private:114": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.theuniversityofcomilla.com/at-a-glance/",
        "Official University of Comilla page lists current location at Uttara, Dhaka-1230 and proposed future permanent campus at Ashulia, Dhaka. UGC operational-status annotations remain separate from this location recommendation."
    ),
    "ugc:private:115": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.queensuniversity.edu.bd/",
        "Official Queens University site lists House 43, Block E, Road 17A, Banani, Dhaka. UGC operational-status annotations remain separate from this location recommendation."
    ),
    "ugc:private:116": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://americabangladeshuniversity.com/",
        "America Bangladesh University material lists its main campus at Baridhara-Nodda, Dhaka-1212 and permanent campus at Nawabganj, Dhaka-1320. Both are in Dhaka district. UGC operational-status annotations remain separate."
    ),
    "ugc:private:13": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.aub.ac.bd/contact",
        "Official Asian University of Bangladesh contact page lists Bangabandhu Road, Tongabari, Ashulia, Dhaka."
    ),
    "ugc:private:19": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://bgctub.ac.bd/php_files/contents/contents.php?cmd=contact",
        "Official BGC Trust University Bangladesh contact page lists BGC Biddyanagar, Chandanaish, Chattogram."
    ),
    "ugc:private:2": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://ustc.ac.bd/contact/",
        "Official USTC contact page lists Foy's Lake, Zakir Hossain Road, Chattogram-4202."
    ),
    "ugc:private:41": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://vub.edu.bd/vubnx/about.php?id=5",
        "Official Victoria University of Bangladesh page lists 58/11/A Panthapath, Dhaka. UGC operational-status annotations remain separate from this location recommendation."
    ),
    "ugc:private:43": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.pu.edu.bd/contact",
        "Official Presidency University contact page lists House 11/A, Road 92, Gulshan-2, Dhaka-1212."
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

for row in rows[:10]:
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
    row["assistant_review_batch"] = "NONE_BATCH_01"
    selected.append(row)

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in selected))
print("needs_model_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_MODEL_POLICY" for r in selected))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in selected))
print("needs_more_evidence =", sum(r.get("assistant_location_recommendation") == "NEEDS_MORE_EVIDENCE" for r in selected))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in selected))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in selected))
print("output =", dst)
