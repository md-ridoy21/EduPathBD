#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 split_ugc_institution_staging.py <institution_draft_ready.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

EXISTING = {
    "ugc:public:1": {
        "existing_institution_id": "inst_du",
        "expected_name": "University of Dhaka",
        "expected_slug": "university-of-dhaka",
        "expected_district_name": "Dhaka",
        "expected_district_code": "BD-DHA",
        "existing_verification_status": "VERIFIED",
    },
    "ugc:public:5": {
        "existing_institution_id": "inst_cu",
        "expected_name": "University of Chittagong",
        "expected_slug": "university-of-chittagong",
        "expected_district_name": "Chattogram",
        "expected_district_code": "BD-CTG",
        "existing_verification_status": "VERIFIED",
    },
}

def clean(v):
    return (v or "").strip()

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

if len(rows) != 110:
    print(f"ERROR: expected 110 staged rows, found {len(rows)}")
    raise SystemExit(1)

insert_rows = []
link_rows = []
errors = []

for row in rows:
    rid = clean(row.get("source_record_id")).lower()

    if rid not in EXISTING:
        insert_rows.append(row)
        continue

    expected = EXISTING[rid]
    row_errors = []

    if clean(row.get("canonical_name")) != expected["expected_name"]:
        row_errors.append("name mismatch")
    if clean(row.get("slug")) != expected["expected_slug"]:
        row_errors.append("slug mismatch")
    if clean(row.get("district_name")) != expected["expected_district_name"]:
        row_errors.append("district name mismatch")
    if clean(row.get("district_code")) != expected["expected_district_code"]:
        row_errors.append("district code mismatch")
    if clean(row.get("verification_status")) != "DRAFT":
        row_errors.append("staged row is not DRAFT")
    if clean(row.get("production_verified")) != "NO":
        row_errors.append("staged row production_verified is not NO")

    if row_errors:
        errors.append({
            "source_record_id": rid,
            "issues": row_errors,
        })
        continue

    link_rows.append({
        "source_id": "source_ugc",
        "source_record_id": rid,
        "existing_institution_id": expected["existing_institution_id"],
        "canonical_name": expected["expected_name"],
        "slug": expected["expected_slug"],
        "district_name": expected["expected_district_name"],
        "district_code": expected["expected_district_code"],
        "existing_verification_status": expected["existing_verification_status"],
        "proposed_change": "BACKFILL_SOURCE_RECORD_ID_ONLY",
        "proposed_source_record_id": rid,
        "preserve_verification_status": "YES",
        "preserve_existing_fields": "YES",
        "human_approval_required": "YES",
        "db_write_now": "NO",
        "identity_source_url": clean(row.get("identity_source_url")),
        "location_source_url": clean(row.get("location_source_url")),
        "note": (
            "Exact staged-to-existing canonical identity match. "
            "Do not insert duplicate Institution. Proposal is lineage-only; "
            "existing VERIFIED status and all other fields must remain unchanged."
        ),
    })

insert_path = out_dir / "institution_new_draft_insert_candidates.csv"
link_path = out_dir / "institution_existing_lineage_link_proposals.csv"
manifest_path = out_dir / "SPLIT_MANIFEST.json"

with insert_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(insert_rows)

link_fields = [
    "source_id",
    "source_record_id",
    "existing_institution_id",
    "canonical_name",
    "slug",
    "district_name",
    "district_code",
    "existing_verification_status",
    "proposed_change",
    "proposed_source_record_id",
    "preserve_verification_status",
    "preserve_existing_fields",
    "human_approval_required",
    "db_write_now",
    "identity_source_url",
    "location_source_url",
    "note",
]

with link_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=link_fields)
    w.writeheader()
    w.writerows(link_rows)

manifest = {
    "status": "PASS_CANONICAL_COLLISION_SPLIT" if not errors and len(insert_rows) == 108 and len(link_rows) == 2 else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputRows": len(rows),
    "newDraftInsertCandidates": len(insert_rows),
    "existingCanonicalLineageLinkProposals": len(link_rows),
    "errors": errors,
    "policy": {
        "newRowsVerificationStatus": "DRAFT",
        "existingRowsVerificationStatusPreserved": True,
        "duplicateInstitutionInsertAllowed": False,
        "lineageBackfillRequiresHumanApproval": True,
    },
    "canonicalMatches": [
        {
            "sourceRecordId": "ugc:public:1",
            "existingInstitutionId": "inst_du",
            "name": "University of Dhaka",
        },
        {
            "sourceRecordId": "ugc:public:5",
            "existingInstitutionId": "inst_cu",
            "name": "University of Chittagong",
        },
    ],
    "files": {
        "newDraftInsertCandidates": insert_path.name,
        "existingLineageLinkProposals": link_path.name,
    },
}

manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

print("========================================")
print("UGC INSTITUTION CANONICAL COLLISION SPLIT")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("FILES")
print(insert_path)
print(link_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if manifest["status"] != "PASS_CANONICAL_COLLISION_SPLIT":
    raise SystemExit(2)
