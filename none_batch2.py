#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 none_batch2.py <unreviewed_v2.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:52": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.eub.edu.bd/contact-us",
        "Official European University of Bangladesh contact page lists 2/4 Gabtoli, Mirpur, Dhaka-1216. UGC operational-status annotations remain separate from this location recommendation."
    ),
    "ugc:private:60": (
        "RECOMMEND_ACCEPT_NEEDS_CODE_LOOKUP", "Chapainawabganj", "",
        "https://ebaub.ac.bd/",
        "Official EXIM Bank Agricultural University Bangladesh site lists 69-69/1 Boro Indara Moor, Chapainawabganj, Postcode-6300. District is supported, but the exact EduPath custom District.code for Chapainawabganj was not available in reviewed project evidence, so no code is invented."
    ),
    "ugc:private:68": (
        "RECOMMEND_ACCEPT", "Chattogram", "BD-CTG",
        "https://ciu.ac.bd/contact-us/",
        "Official Chittagong Independent University contact page lists Minhaj Complex, 12 Jamal Khan Road, Chattogram."
    ),
    "ugc:private:75": (
        "RECOMMEND_ACCEPT", "Cox's Bazar", "BD-COX",
        "https://cbiu.ac.bd/contact",
        "Official Cox's Bazar International University contact page lists Kolatoli Circle, Cox's Bazar-4700."
    ),
    "ugc:private:76": (
        "RECOMMEND_ACCEPT", "Narayanganj", "BD-NAR",
        "https://rpsu.ac.bd/faculty/profile/samia-jaman-karobi",
        "Official R. P. Shaha University domain lists the university in Narayanganj and provides the reach-out address at Sultan Giasuddin Road, Shitalakhya, Narayanganj-1400."
    ),
    "ugc:private:91": (
        "RECOMMEND_ACCEPT", "Barishal", "BD-BSL",
        "https://ugv.edu.bd/contact",
        "Official University of Global Village contact page lists 874/322 C&B Road, Barishal-8200."
    ),
    "ugc:private:98": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://smmuniversity.ac/",
        "Official Shah Makhdum Management University site states its campus is at Rajshahi; BANBEIS government records also place Shah Makhdum Management University in Rajshahi."
    ),
    "ugc:public:10": (
        "RECOMMEND_ACCEPT", "Gazipur", "BD-GAZ",
        "https://www.nu.ac.bd/contact.php",
        "Official National University registrar contact lists National University, Gazipur-1704. The university's at-a-glance page identifies Gazipur as the main campus and Dhaka as a city office."
    ),
    "ugc:public:30": (
        "RECOMMEND_ACCEPT", "Rangpur", "BD-RNG",
        "https://brur.ac.bd/public/offices/office-of-the-vice-chancellor",
        "Official Begum Rokeya University page identifies the administrative building and university in Rangpur; official campus contact lists Park Mor, Modern, Rangpur-5404."
    ),
    "ugc:public:50": (
        "RECOMMEND_ACCEPT", "Khulna", "BD-KHU",
        "https://kmu.ac.bd/",
        "Current official Khulna Medical University site identifies the university in Khulna and lists Holding 8, Road 1, Nirala Residential Area, Khulna-9100."
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

for row in rows[10:20]:
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
    row["assistant_review_batch"] = "NONE_BATCH_02"
    selected.append(row)

dst.parent.mkdir(parents=True, exist_ok=True)

with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in selected))
print("recommend_accept_needs_code_lookup =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT_NEEDS_CODE_LOOKUP" for r in selected))
print("needs_model_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_MODEL_POLICY" for r in selected))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in selected))
print("needs_more_evidence =", sum(r.get("assistant_location_recommendation") == "NEEDS_MORE_EVIDENCE" for r in selected))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in selected))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in selected))
print("output =", dst)
