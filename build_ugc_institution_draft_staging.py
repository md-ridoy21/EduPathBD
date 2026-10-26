#!/usr/bin/env python3
import csv
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from collections import Counter

if len(sys.argv) != 3:
    print("Usage: python3 build_ugc_institution_draft_staging.py <final_reconciliation.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

if not src.exists():
    print("ERROR: final reconciliation file not found:", src)
    raise SystemExit(1)

def clean(v):
    return (v or "").strip()

def norm_id(v):
    return clean(v).lower()

def slugify(value):
    text = unicodedata.normalize("NFKD", clean(value))
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")

def https_or_blank(value):
    value = clean(value)
    if not value:
        return ""
    if value.lower().startswith("https://"):
        return value
    return ""

def staging_id(source_record_id):
    digest = hashlib.sha256(
        f"ugc-institution-v6.3|{source_record_id}".encode("utf-8")
    ).hexdigest()[:24]
    return f"stage:ugc-institution:v6.3:{digest}"

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))

if len(rows) != 119:
    print(f"ERROR: expected 119 reconciliation rows, found {len(rows)}")
    raise SystemExit(1)

ready = []
holds = []
corrections = []
unexpected = []

for row in rows:
    action = clean(row.get("assistant_location_recommendation"))
    rid = norm_id(row.get("parent_source_record_id"))
    name = clean(row.get("canonical_name"))

    if action == "RECOMMEND_ACCEPT":
        district = clean(row.get("assistant_recommended_district"))
        district_code = clean(row.get("assistant_recommended_district_code"))

        ready.append({
            "staging_id": staging_id(rid),
            "source_id": "source_ugc",
            "source_record_id": rid,
            "canonical_name": name,
            "slug": slugify(name),
            "institution_category": clean(row.get("category")).lower(),
            "district_name": district,
            "district_code": district_code,
            "website_url": https_or_blank(row.get("official_website_raw")),
            "identity_source_url": https_or_blank(row.get("identity_source_url")),
            "location_source_url": https_or_blank(row.get("assistant_recommendation_source_url")),
            "location_review_action": action,
            "location_review_note": clean(row.get("assistant_recommendation_note")),
            "verification_status": "DRAFT",
            "production_verified": "NO",
            "staging_package": "v6.3",
        })

    elif action in {"NEEDS_CAMPUS_POLICY", "NEEDS_MODEL_POLICY"}:
        holds.append(row)

    elif action == "RECOMMEND_CORRECT_CANDIDATE":
        corrections.append(row)

    else:
        unexpected.append(row)

# Integrity checks.
ready_ids = [r["source_record_id"] for r in ready]
ready_staging_ids = [r["staging_id"] for r in ready]
ready_slugs = [r["slug"] for r in ready]

duplicate_source_ids = sorted(
    k for k, v in Counter(ready_ids).items() if k and v > 1
)
duplicate_staging_ids = sorted(
    k for k, v in Counter(ready_staging_ids).items() if k and v > 1
)
slug_collisions = sorted(
    k for k, v in Counter(ready_slugs).items() if k and v > 1
)

missing_name = [r["source_record_id"] for r in ready if not r["canonical_name"]]
missing_district = [r["source_record_id"] for r in ready if not r["district_name"]]
missing_district_code = [r["source_record_id"] for r in ready if not r["district_code"]]
bad_identity_source = [
    r["source_record_id"] for r in ready
    if not r["identity_source_url"].startswith("https://")
]
bad_location_source = [
    r["source_record_id"] for r in ready
    if not r["location_source_url"].startswith("https://")
]
non_draft = [
    r["source_record_id"] for r in ready
    if r["verification_status"] != "DRAFT"
]
verified_yes = [
    r["source_record_id"] for r in ready
    if r["production_verified"] != "NO"
]

human_fields_nonblank = sum(
    bool(clean(r.get("human_decision"))) or
    bool(clean(r.get("accepted_district"))) or
    bool(clean(r.get("accepted_district_code")))
    for r in rows
)

def write_csv(path, data, fields):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(data)

ready_fields = [
    "staging_id",
    "source_id",
    "source_record_id",
    "canonical_name",
    "slug",
    "institution_category",
    "district_name",
    "district_code",
    "website_url",
    "identity_source_url",
    "location_source_url",
    "location_review_action",
    "location_review_note",
    "verification_status",
    "production_verified",
    "staging_package",
]

ready_path = out_dir / "institution_draft_ready.csv"
holds_path = out_dir / "institution_policy_holds.csv"
corrections_path = out_dir / "institution_corrected_candidates.csv"
slug_path = out_dir / "institution_slug_collisions.csv"
manifest_path = out_dir / "STAGING_MANIFEST.json"

write_csv(ready_path, ready, ready_fields)

original_fields = list(rows[0].keys()) if rows else []
write_csv(holds_path, holds, original_fields)
write_csv(corrections_path, corrections, original_fields)

write_csv(
    slug_path,
    [{"slug": s, "count": Counter(ready_slugs)[s]} for s in slug_collisions],
    ["slug", "count"],
)

hard_stop_reasons = []

checks = {
    "expected_ready_count_110": len(ready) == 110,
    "expected_policy_holds_7": len(holds) == 7,
    "expected_corrected_candidates_2": len(corrections) == 2,
    "no_unexpected_actions": len(unexpected) == 0,
    "no_duplicate_source_ids": len(duplicate_source_ids) == 0,
    "no_duplicate_staging_ids": len(duplicate_staging_ids) == 0,
    "no_slug_collisions": len(slug_collisions) == 0,
    "all_ready_have_names": len(missing_name) == 0,
    "all_ready_have_districts": len(missing_district) == 0,
    "all_ready_have_district_codes": len(missing_district_code) == 0,
    "all_ready_have_https_identity_source": len(bad_identity_source) == 0,
    "all_ready_have_https_location_source": len(bad_location_source) == 0,
    "all_ready_are_draft": len(non_draft) == 0,
    "all_ready_are_not_production_verified": len(verified_yes) == 0,
    "human_decision_fields_untouched": human_fields_nonblank == 0,
}

for key, passed in checks.items():
    if not passed:
        hard_stop_reasons.append(key)

manifest = {
    "status": "PASS_INSTITUTION_DRAFT_STAGING" if not hard_stop_reasons else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "sourceId": "source_ugc",
    "canonicalParentJoin": "source_ugc + case-insensitive sourceRecordId",
    "authorityCodePolicy": "REFERENCE_ONLY_NOT_JOIN_KEY",
    "stagingPackage": "v6.3",
    "inputRows": len(rows),
    "draftReady": len(ready),
    "policyHolds": len(holds),
    "correctedCandidates": len(corrections),
    "unexpectedActions": len(unexpected),
    "duplicateSourceIds": len(duplicate_source_ids),
    "duplicateStagingIds": len(duplicate_staging_ids),
    "slugCollisions": len(slug_collisions),
    "missingNames": len(missing_name),
    "missingDistricts": len(missing_district),
    "missingDistrictCodes": len(missing_district_code),
    "badIdentitySourceUrls": len(bad_identity_source),
    "badLocationSourceUrls": len(bad_location_source),
    "nonDraftRows": len(non_draft),
    "productionVerifiedYesCount": len(verified_yes),
    "humanDecisionFieldsNonblank": human_fields_nonblank,
    "checks": checks,
    "hardStopReasons": hard_stop_reasons,
    "files": {
        "draftReady": ready_path.name,
        "policyHolds": holds_path.name,
        "correctedCandidates": corrections_path.name,
        "slugCollisions": slug_path.name,
    },
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

print("========================================")
print("UGC INSTITUTION DRAFT STAGING")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(ready_path)
print(holds_path)
print(corrections_path)
print(slug_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stop_reasons:
    raise SystemExit(2)
