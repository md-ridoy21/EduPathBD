#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build-single-text-batch1-recommendations.py <single_text_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:10": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://admission.uap-bd.edu/Admission/Home.aspx", "Official UAP contact details list 74/A Green Road, Dhaka-1205."),
    "ugc:private:100": ("NEEDS_CAMPUS_POLICY", "", "", "https://www.isu.ac.bd/", "Current official material references Dhaka operations/contact and a permanent-campus site in Purbachal. Do not collapse to a single Institution.district until campus-location policy is defined."),
    "ugc:private:101": ("RECOMMEND_ACCEPT", "Brahmanbaria", "BD-BRA", "https://uob.edu.bd/contact-us/", "Official University of Brahmanbaria contact page lists Bypass Road, Brahmanbaria-3400."),
    "ugc:private:106": ("RECOMMEND_ACCEPT", "Chattogram", "BD-CTG", "https://cbuft.edu.bd/pages/index.php?menu=contact_us", "Official CBUFT contact page lists Jhautala Road, South Khulshi, Chattogram."),
    "ugc:private:107": ("RECOMMEND_ACCEPT", "Khulna", "BD-KHU", "https://baustkhulna.ac.bd/contact-us/", "Official BAUST Khulna contact page lists both present and permanent campuses in Khulna District."),
    "ugc:private:109": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://www.iiustb.ac.bd/", "Official IIUSTB site lists permanent campus at Baipail, Ashulia, Dhaka-1349."),
    "ugc:private:11": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://gonouniversity.edu.bd/contact-us/", "Official Gono Bishwabidyalay contact page lists Ashulia, Savar, Dhaka-1344."),
    "ugc:private:110": ("RECOMMEND_ACCEPT", "Kushtia", "BD-KUS", "https://lusa.ac.bd/contact-us/", "Official Lalon University contact page lists Zilla Parishad Bhaban, NS Road, Kushtia-7000."),
    "ugc:private:14": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://www.diu.ac/contact", "Official Dhaka International University contact page lists permanent campus at Satarkul, Badda, Dhaka-1212."),
    "ugc:private:15": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://miuportal.manarat.ac.bd/miuportal/verify.aspx", "Official Manarat portal lists Gulshan and permanent Ashulia campuses, both in Dhaka."),
    "ugc:private:18": ("RECOMMEND_ACCEPT", "Sylhet", "BD-SYL", "https://lus.ac.bd/", "Official Leading University site identifies campus location as Sylhet."),
    "ugc:private:21": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://uoda.edu.bd/", "Official UODA site lists administrative office at Satmosjid Road, Dhanmondi, Dhaka-1209."),
    "ugc:private:22": ("RECOMMEND_ACCEPT", "Chattogram", "BD-CTG", "https://puc.ac.bd/Home/Content/?Alias=contact", "Official Premier University contact page lists its campuses in Chattogram."),
    "ugc:private:25": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://www.stamforduniversity.edu.bd/index.php/stamford/details/4", "Official Stamford campus page lists permanent and Siddeswari campuses in Dhaka."),
    "ugc:private:27": ("RECOMMEND_ACCEPT", "Dhaka", "BD-DHA", "https://www.cityuniversity.ac.bd/contact", "Official City University contact page lists permanent campus at Khagan, Birulia, Savar, Dhaka-1340."),
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
for row in rows[:15]:
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
    row["assistant_review_batch"] = "SINGLE_TEXT_BATCH_01"
    selected.append(row)

dst.parent.mkdir(parents=True, exist_ok=True)
with dst.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(selected)

print("rows =", len(selected))
print("recommend_accept =", sum(r.get("assistant_location_recommendation") == "RECOMMEND_ACCEPT" for r in selected))
print("needs_campus_policy =", sum(r.get("assistant_location_recommendation") == "NEEDS_CAMPUS_POLICY" for r in selected))
print("human_decisions_changed =", sum(bool((r.get("human_decision") or "").strip()) for r in selected))
print("accepted_districts_changed =", sum(bool((r.get("accepted_district_code") or "").strip()) for r in selected))
print("output =", dst)
