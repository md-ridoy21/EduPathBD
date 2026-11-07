#!/usr/bin/env python3
import csv
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 build_admission_scholarship_evidence_staging.py <final_approve_recommendations_v6_2.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out = Path(sys.argv[2]).expanduser().resolve()
out.mkdir(parents=True, exist_ok=True)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    all_rows = list(csv.DictReader(f))

def clean(v):
    return str(v or "").strip()

def pipe(v):
    return [x.strip() for x in clean(v).split("|") if x.strip()]

def parent_id(v):
    s = clean(v)
    parts = s.split(":")
    if len(parts) >= 3 and parts[0].upper() == "UGC":
        return "ugc:" + ":".join([parts[1].lower(), *parts[2:]])
    return ""

def primary_source(r):
    urls = pipe(r.get("source_urls"))
    if urls:
        return urls[0]
    return clean(r.get("assistant_recommended_source_cumulative"))

def normalized_value(r):
    return clean(r.get("assistant_recommended_normalized_value_cumulative")) or clean(r.get("assistant_recommended_normalized_value_v5_2"))

def normalized_source(r):
    return clean(r.get("assistant_recommended_source_cumulative")) or clean(r.get("assistant_recommended_source_v5_2"))

def decision(r):
    return clean(r.get("assistant_recommended_decision_cumulative")) or clean(r.get("assistant_recommended_decision_v5_2"))

def action(r):
    return clean(r.get("assistant_recommended_action_cumulative")) or clean(r.get("assistant_recommended_action_v5_2"))

selected = [r for r in all_rows if clean(r.get("dataset")).lower() in {"admission", "scholarship"}]

if len(selected) != 1336:
    raise SystemExit(f"HARD_STOP: expected 1336 selected rows, got {len(selected)}")

records = []
for r in selected:
    ds = clean(r.get("dataset")).upper()
    candidate_id = clean(r.get("canonical_candidate_id"))
    if not candidate_id:
        raise SystemExit("HARD_STOP: missing canonical_candidate_id")
    if clean(r.get("production_verified")).upper() != "NO":
        raise SystemExit(f"HARD_STOP: production_verified != NO for {candidate_id}")

    extracted = {
        "suggestedFactType": clean(r.get("suggested_fact_type")),
        "suggestedGpaValues": pipe(r.get("suggested_gpa_values")),
        "suggestedMoneyValues": pipe(r.get("suggested_money_values")),
        "suggestedDateValues": pipe(r.get("suggested_date_values")),
        "suggestedPercentValues": pipe(r.get("suggested_percent_values")),
        "finalScholarshipName": clean(r.get("final_scholarship_name")),
        "finalAwardPercent": clean(r.get("final_award_percent")),
        "finalAwardAmount": clean(r.get("final_award_amount")),
        "finalMinimumGpa": clean(r.get("final_minimum_gpa")),
        "finalEligibility": clean(r.get("final_eligibility")),
        "finalDeadline": clean(r.get("final_deadline")),
        "finalRenewalCondition": clean(r.get("final_renewal_condition")),
        "evidenceStrength": clean(r.get("evidence_strength")),
        "rawEvidenceCount": clean(r.get("raw_evidence_count")),
        "distinctSourceCount": clean(r.get("distinct_source_count")),
        "reviewNotes": clean(r.get("review_notes")),
        "assistantReviewNote": clean(r.get("assistant_review_note_cumulative")),
    }

    rec = {
        "dataset": ds,
        "source_record_id": candidate_id,
        "parent_source_record_id": parent_id(r.get("canonical_record_id")),
        "institution_name": clean(r.get("institution_name")),
        "candidate_type": clean(r.get("candidate_type")),
        "source_candidate_text": clean(r.get("source_candidate_text")),
        "source_url": primary_source(r),
        "page_sha256_values_json": json.dumps(pipe(r.get("page_sha256_values")), ensure_ascii=False),
        "extracted_values_json": json.dumps(extracted, ensure_ascii=False, separators=(",", ":")),
        "assistant_decision": decision(r),
        "assistant_action": action(r),
        "normalized_value": normalized_value(r),
        "normalized_source_url": normalized_source(r),
        "verification_status": "PENDING",
        "production_verified": "NO",
    }
    if not rec["source_url"]:
        raise SystemExit(f"HARD_STOP: missing source URL for {candidate_id}")
    records.append(rec)

fields = list(records[0].keys())

def write(name, rows):
    path = out / name
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    return path

write("source_evidence_1336.csv", records)
ad = [r for r in records if r["dataset"] == "ADMISSION"]
sch = [r for r in records if r["dataset"] == "SCHOLARSHIP"]
write("admission_evidence_682.csv", ad)
write("scholarship_evidence_654.csv", sch)
write("admission_eligibility_356.csv", [r for r in ad if r["candidate_type"] == "GPA_OR_ELIGIBILITY"])
write("admission_fee_87.csv", [r for r in ad if r["candidate_type"] == "FEE_OR_COST"])
write("admission_deadline_239.csv", [r for r in ad if r["candidate_type"] == "DATE_OR_DEADLINE"])

def group_rows(rows, group_name):
    groups = defaultdict(list)
    for r in rows:
        groups[(r["parent_source_record_id"], r["source_url"])].append(r)

    out_rows = []
    for (parent, url), vals in sorted(groups.items()):
        ids = [v["source_record_id"] for v in vals]
        key = f"{parent}|{url}".lower()
        group_id = f"{group_name}:{hashlib.sha256(key.encode()).hexdigest()[:24]}"
        out_rows.append({
            "group_id": group_id,
            "parent_source_record_id": parent,
            "institution_name": vals[0]["institution_name"],
            "source_url": url,
            "fragment_count": str(len(vals)),
            "candidate_ids_json": json.dumps(ids, ensure_ascii=False),
            "source_texts_json": json.dumps([v["source_candidate_text"] for v in vals], ensure_ascii=False),
            "normalized_values_json": json.dumps([v["normalized_value"] for v in vals if v["normalized_value"]], ensure_ascii=False),
            "status": "RECONSTRUCTION_PENDING",
        })
    return out_rows

def write_group(name, rows):
    path = out / name
    gf = ["group_id","parent_source_record_id","institution_name","source_url","fragment_count","candidate_ids_json","source_texts_json","normalized_values_json","status"]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=gf)
        w.writeheader()
        w.writerows(rows)

elig_groups = group_rows([r for r in ad if r["candidate_type"] == "GPA_OR_ELIGIBILITY"], "admission-policy")
sch_groups = group_rows(sch, "scholarship-policy")
write_group("admission_policy_groups.csv", elig_groups)
write_group("scholarship_policy_groups.csv", sch_groups)

promotion = []
for r in records:
    if not r["normalized_value"]:
        continue
    if r["dataset"] == "ADMISSION" and "FEE" in r["assistant_action"].upper():
        continue
    promotion.append(r)
write("explicit_normalized_promotion_candidates.csv", promotion)

checks = {
    "total1336": len(records) == 1336,
    "admission682": len(ad) == 682,
    "scholarship654": len(sch) == 654,
    "eligibility356": sum(r["candidate_type"] == "GPA_OR_ELIGIBILITY" for r in ad) == 356,
    "fee87": sum(r["candidate_type"] == "FEE_OR_COST" for r in ad) == 87,
    "deadline239": sum(r["candidate_type"] == "DATE_OR_DEADLINE" for r in ad) == 239,
    "allPending": all(r["verification_status"] == "PENDING" for r in records),
    "allProductionVerifiedNo": all(r["production_verified"] == "NO" for r in records),
    "uniqueSourceRecordIds": len({r["source_record_id"] for r in records}) == 1336,
}

manifest = {
    "status": "PASS_EVIDENCE_STAGING" if all(checks.values()) else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "counts": {
        "totalEvidence": len(records),
        "admission": len(ad),
        "scholarship": len(sch),
        "admissionEligibility": sum(r["candidate_type"] == "GPA_OR_ELIGIBILITY" for r in ad),
        "admissionFee": sum(r["candidate_type"] == "FEE_OR_COST" for r in ad),
        "admissionDeadline": sum(r["candidate_type"] == "DATE_OR_DEADLINE" for r in ad),
        "admissionPolicyGroups": len(elig_groups),
        "scholarshipPolicyGroups": len(sch_groups),
        "explicitNormalizedPromotionCandidates": len(promotion),
    },
    "checks": checks,
    "policy": {
        "structuredEntityAutoPromotionPerformed": False,
        "fakeOrInferredValuesAllowed": False,
        "verificationStatus": "PENDING",
        "verifiedPublicationAllowed": False,
        "feeFragmentsForcedIntoAdmissionRule": False,
        "deadlineFragmentsForcedIntoAdmissionRule": False,
    }
}
(out / "EVIDENCE_STAGING_MANIFEST.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
if manifest["status"] == "HARD_STOP":
    raise SystemExit(2)
