#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python3 build_corrected_parents_staging.py <output-dir>")
    raise SystemExit(2)

out_dir = Path(sys.argv[1]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

rows = [
    {
        "source_id": "source_ugc",
        "source_record_id": "ugc:private:58",
        "canonical_name": "Ishakha International University, Bangladesh",
        "slug": "ishakha-international-university-bangladesh",
        "institution_category": "private",
        "district_name": "Kishoreganj",
        "district_code": "BD-KIS",
        "identity_source_url": "https://www.ugc-universities.gov.bd/private-universities",
        "location_source_url": "https://www.ishakha.edu.bd/en/contact/",
        "location_review_action": "RECOMMEND_CORRECT_CANDIDATE",
        "location_review_note": (
            "Collector candidate Mymensingh corrected to Kishoreganj. "
            "Official IIUB contact lists Nilganj Road, 461 Sholakia Road, "
            "Kishoreganj-2300. Exact EduPath District.code confirmed read-only: BD-KIS."
        ),
        "verification_status": "DRAFT",
        "production_verified": "NO",
        "staging_package": "v6.3-corrected-parents",
    },
    {
        "source_id": "source_ugc",
        "source_record_id": "ugc:private:80",
        "canonical_name": "Bangladesh Army University of Science and Technology (BAUST), Saidpur",
        "slug": "bangladesh-army-university-of-science-and-technology-baust-saidpur",
        "institution_category": "private",
        "district_name": "Nilphamari",
        "district_code": "BD-NIL",
        "identity_source_url": "https://www.ugc-universities.gov.bd/private-universities",
        "location_source_url": "https://www.baust.edu.bd/",
        "location_review_action": "RECOMMEND_CORRECT_CANDIDATE",
        "location_review_note": (
            "Collector candidate Rangpur corrected to Nilphamari. "
            "Official BAUST site lists Saidpur Cantonment, Saidpur; "
            "government records place Saidpur Cantonment in Nilphamari district. "
            "Exact EduPath District.code confirmed read-only: BD-NIL."
        ),
        "verification_status": "DRAFT",
        "production_verified": "NO",
        "staging_package": "v6.3-corrected-parents",
    },
]

fields = list(rows[0].keys())
csv_path = out_dir / "corrected_parent_draft_ready.csv"
manifest_path = out_dir / "CORRECTED_PARENT_MANIFEST.json"

with csv_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(rows)

checks = {
    "expected_rows_2": len(rows) == 2,
    "all_source_ugc": all(r["source_id"] == "source_ugc" for r in rows),
    "all_draft": all(r["verification_status"] == "DRAFT" for r in rows),
    "all_not_production_verified": all(r["production_verified"] == "NO" for r in rows),
    "all_have_district_codes": all(bool(r["district_code"]) for r in rows),
    "all_sources_https": all(
        r["identity_source_url"].startswith("https://")
        and r["location_source_url"].startswith("https://")
        for r in rows
    ),
}

hard_stops = [k for k, v in checks.items() if not v]

manifest = {
    "status": "PASS_CORRECTED_PARENT_STAGING" if not hard_stops else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "rows": len(rows),
    "sourceRecordIds": [r["source_record_id"] for r in rows],
    "districtResolutions": [
        {
            "sourceRecordId": "ugc:private:58",
            "district": "Kishoreganj",
            "districtCode": "BD-KIS",
        },
        {
            "sourceRecordId": "ugc:private:80",
            "district": "Nilphamari",
            "districtCode": "BD-NIL",
        },
    ],
    "checks": checks,
    "hardStopReasons": hard_stops,
    "file": csv_path.name,
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

print("========================================")
print("CORRECTED UGC PARENT DRAFT STAGING")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(csv_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stops:
    raise SystemExit(2)
