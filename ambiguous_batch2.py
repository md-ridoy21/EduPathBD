#!/usr/bin/env python3
import csv
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 ambiguous_batch2.py <ambiguous_candidates.csv> <output.csv>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
dst = Path(sys.argv[2]).expanduser().resolve()

recommendations = {
    "ugc:private:64": (
        "RECOMMEND_ACCEPT", "Feni", "BD-FEN",
        "https://feniuniversity.ac.bd/content/contact-us",
        "Official Feni University contact page lists Feni University, Trunk Road, Feni-3900."
    ),
    "ugc:private:65": (
        "RECOMMEND_ACCEPT", "Cumilla", "BD-COM",
        "https://www.britannia.edu.bd/contact",
        "Official Britannia University contact page lists Paduar Bazar, Bishwa Road, Cumilla."
    ),
    "ugc:private:70": (
        "RECOMMEND_ACCEPT", "Faridpur", "BD-FAR",
        "https://timesuniversitybd.com/",
        "Official Times University Bangladesh site identifies itself as a private university in Faridpur and states its campus is situated mainly in Faridpur."
    ),
    "ugc:private:71": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://nbiu.edu.bd/contact/contactus.php",
        "Official North Bengal International University contact page lists Chowddopai, Natore Road, Motihar, Rajshahi."
    ),
    "ugc:private:73": (
        "RECOMMEND_ACCEPT", "Natore", "BD-NAT",
        "https://rstu.ac/contact.php",
        "Official RSTU contact page identifies the campus in Natore; external district mentions are contextual/noise."
    ),
    "ugc:private:77": (
        "NEEDS_CAMPUS_POLICY", "", "",
        "https://gub.edu.bd/contact-us/",
        "Official German University Bangladesh contact page lists a Gazipur campus/address and a permanent campus at Ghatail, Tangail. Do not select one singular district until campus-location policy is defined."
    ),
    "ugc:private:81": (
        "RECOMMEND_ACCEPT", "Natore", "BD-NAT",
        "https://bauet.ac.bd/contact-us/",
        "Official BAUET contact page lists Qadirabad Cantonment, Dayarampur, Natore-6431."
    ),
    "ugc:private:82": (
        "RECOMMEND_ACCEPT", "Cumilla", "BD-COM",
        "https://baiust.ac.bd/contact/",
        "Official BAIUST contact page lists Syedpur, Adarsha Sadar, Cumilla."
    ),
    "ugc:private:85": (
        "RECOMMEND_ACCEPT", "Manikganj", "BD-MAN",
        "https://npiub.edu.bd/",
        "Official NPI University of Bangladesh site lists 495 East Basta, Singair, Manikganj."
    ),
    "ugc:private:93": (
        "RECOMMEND_ACCEPT", "Dhaka", "BD-DHA",
        "https://akmu.edu.bd/contact-us/",
        "Official Anwer Khan Modern University contact page lists Sector 11, Uttara, Dhaka-1230; its Dhanmondi admission booth is also in Dhaka."
    ),
    "ugc:private:95": (
        "RECOMMEND_ACCEPT", "Rajshahi", "BD-RJS",
        "https://amust.ac.bd/contact/",
        "Official AMUST contact page lists Mirzapur, Binodpur Bazar, Motihar, Rajshahi-6206."
    ),
    "ugc:private:96": (
        "RECOMMEND_ACCEPT", "Khulna", "BD-KHU",
        "https://www.kkbau.ac.bd/",
        "Khulna Khan Bahadur Ahsanullah University is consistently identified at its Khulna campus; no competing district campus was found in the reviewed evidence."
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

for row in rows[12:24]:
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
    row["assistant_review_batch"] = "AMBIGUOUS_BATCH_02"
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
