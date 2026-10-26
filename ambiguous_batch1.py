#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 ambiguous_batch1.py <ambiguous_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:105": (
        "RECOMMEND_ACCEPT", "Kishoreganj", "BD-KIS",
        "https://must.ac.bd/contact/",
        "Official MUST contact page explicitly identifies the Permanent Campus at Banshgari, Bhairab, Kishoreganj-2350; Dhaka is listed only as an office."
    ),
    "ugc:private:17": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.bu.edu.bd/",
        "Official Bangladesh University site lists its Permanent Campus at 5/B Beribandh Main Road, Adabar, Mohammadpur, Dhaka-1207."
    ),
    "ugc:private:20": (
        "RECOMMEND_ACCEPT", "Sylhet", "BD-SYL",
        "https://www.siu.edu.bd/contact",
        "Official Sylhet International University contact page lists Shamimabad, Bagbari, Sylhet-3100; official university material identifies it as the permanent campus."
    ),
    "ugc:private:26": (
        "RECOMMEND_ACCEPT", "Narayanganj", "BD-NAR",
        "https://sub.ac.bd/contact",
        "Official State University of Bangladesh contact page lists 696 Kendua, Kanchan, Rupganj, Narayanganj. The university states it now operates exclusively from this permanent campus."
    ),
    "ugc:private:29": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://www.nub.ac.bd/",
        "Official Northern University Bangladesh material places its permanent campus at Ashkona, Dakshin Khan, Dhaka; the current site contact also lists Ashkona, Dhaka-1230."
    ),
    "ugc:private:31": (
        "RECOMMEND_ACCEPT", "Narayanganj", "BD-NAR",
        "https://green.edu.bd/contact-us",
        "Official Green University contact page lists Purbachal American City, Kanchan, Rupganj, Narayanganj-1461. Dhaka references are city information/contact context, not the campus district."
    ),
    "ugc:private:32": (
        "RECOMMEND_ACCEPT", "Bogura", "BD-BOG",
        "https://pundrauniversity.ac.bd/contact",
        "Official Pundra University contact page lists Rangpur Road, Baghopara, Gokul, Bogura."
    ),
    "ugc:private:33": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://wub.edu.bd/about/permanent_campus",
        "Official World University of Bangladesh permanent-campus page lists Sector 17/H, Uttara, Dhaka-1230."
    ),
    "ugc:private:34": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://smuct.ac.bd/contact/",
        "Official Shanto-Mariam University contact page lists the Permanent Campus at Sector 17/H-1, Uttara, Dhaka-1230."
    ),
    "ugc:private:4": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://cwu.edu.bd/contact",
        "Official Central Women's University contact page lists its campus at Hatkhola Road, Dhaka and Permanent Campus at Matuail, Dhaka-1362."
    ),
    "ugc:private:54": (
        "RECOMMEND_ACCEPT", "Munshiganj", "BD-MUN",
        "https://www.hamdarduniversity.edu.bd/hub/contact",
        "Official Hamdard University contact page lists Hamdard City of Science, Education & Culture, Gazaria, Munshiganj-1510."
    ),
    "ugc:private:57": (
        "RECOMMEND_ACCEPT", "Chuadanga", "BD-CHU",
        "https://fcub.edu.bd/",
        "Official First Capital University site lists Ghoramara, Alamdanga Road, Chuadanga Pourashava, Chuadanga-7200."
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

for row in rows[:12]:
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
    row["assistant_review_batch"] = "AMBIGUOUS_BATCH_01"
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
