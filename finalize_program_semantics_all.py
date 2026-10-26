#!/usr/bin/env python3
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 5:
    print(
        "Usage: python3 finalize_program_semantics_all.py "
        "<resolved_1542.csv> <high_47.csv> <medium_57.csv> <output-dir>"
    )
    raise SystemExit(2)

resolved_path = Path(sys.argv[1]).expanduser().resolve()
high_path = Path(sys.argv[2]).expanduser().resolve()
medium_path = Path(sys.argv[3]).expanduser().resolve()
out_dir = Path(sys.argv[4]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

def read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

resolved = read_csv(resolved_path)
high = read_csv(high_path)
medium = read_csv(medium_path)

if len(resolved) != 1542:
    raise SystemExit(f"ERROR: expected 1542 resolved rows, found {len(resolved)}")
if len(high) != 47:
    raise SystemExit(f"ERROR: expected 47 HIGH rows, found {len(high)}")
if len(medium) != 57:
    raise SystemExit(f"ERROR: expected 57 MEDIUM rows, found {len(medium)}")

# These MEDIUM rows contain plausible academic program names embedded inside
# notices, eligibility prose, marketing copy, or aggregate text. The source row
# itself remains non-canonical and is NOT importable as Program. Preserve it for
# a later extraction + deduplication review instead of losing the possible program.
RECOVERY = {
    "stage:ugc-program:v6.3:ed227f22b4c551f56ecc9ba4":
        "LL.M (Final)",
    "stage:ugc-program:v6.3:3d0df4bd9d37b30823d6b612":
        "LL.M (Preliminary)",
    "stage:ugc-program:v6.3:4129a83854dd1efc8611c410":
        "M. Sc. in Textile; M.Sc. in Fashion",
    "stage:ugc-program:v6.3:edc6c0276d1e013948c355c7":
        "Executive M.Sc. in Computer Science (EMCS)",
    "stage:ugc-program:v6.3:b53feedd0b5d101a3b211a2b":
        "B.Sc. in EEE (REGULAR & EVENING)",
    "stage:ugc-program:v6.3:56632a155d4cadcda2cc32fa":
        "Bachelor of Science in Computer Science and Engineering (Evening)",
    "stage:ugc-program:v6.3:a9225e10b684570c685b49b2":
        "Bachelor of Science in Electrical and Electronic Engineering (Regular)",
    "stage:ugc-program:v6.3:d4af6b9a40c44d3693e0a850":
        "B.Sc. (Engineering) in Computer Science and Engineering",
    "stage:ugc-program:v6.3:f73db0c268b57d44fb08a85a":
        "Bachelor of Science (Honors) in Microbiology",
    "stage:ugc-program:v6.3:9cb282c47bdf8d39232b2636":
        "BTHM; BA in English; BBA; BSc in CSE/CSIT (Regular); BSc in CSE/CSIT (For Diploma holder); B.Ed.",
    "stage:ugc-program:v6.3:a258c4647d20d15d6b99dc74":
        "BSc in CSE/CSIT (Regular)",
    "stage:ugc-program:v6.3:9d8319068b20e1e0e7c664d0":
        "MA in English",
}

resolved_by_id = {r["staging_id"]: r for r in resolved}
high_ids = {r["staging_id"] for r in high}
medium_ids = {r["staging_id"] for r in medium}

if len(high_ids) != 47:
    raise SystemExit("ERROR: HIGH staging IDs are not unique")
if len(medium_ids) != 57:
    raise SystemExit("ERROR: MEDIUM staging IDs are not unique")
if high_ids & medium_ids:
    raise SystemExit("ERROR: HIGH/MEDIUM overlap detected")
if not high_ids.issubset(resolved_by_id):
    raise SystemExit("ERROR: some HIGH IDs are missing from resolved 1542")
if not medium_ids.issubset(resolved_by_id):
    raise SystemExit("ERROR: some MEDIUM IDs are missing from resolved 1542")
if not set(RECOVERY).issubset(medium_ids):
    raise SystemExit("ERROR: recovery IDs are not all present in MEDIUM queue")

flagged_ids = high_ids | medium_ids
clean = [r for r in resolved if r["staging_id"] not in flagged_ids]

base_fields = list(resolved[0].keys())
extra_fields = [
    "semantic_final_status",
    "assistant_final_semantic_decision",
    "assistant_final_semantic_note",
    "embedded_program_recovery_hint",
    "human_semantic_decision",
]
out_fields = base_fields + [f for f in extra_fields if f not in base_fields]

quarantine = []
rejects = []
recovery = []

for r in high:
    x = dict(resolved_by_id[r["staging_id"]])
    x["semantic_final_status"] = "QUARANTINED"
    x["assistant_final_semantic_decision"] = "RECOMMEND_REJECT_AS_NON_PROGRAM"
    x["assistant_final_semantic_note"] = (
        "HIGH-confidence semantic contamination. Source row is admission/admin/"
        "document/fee/waiver/application/service text, not a canonical Program row."
    )
    x["embedded_program_recovery_hint"] = ""
    x["human_semantic_decision"] = ""
    quarantine.append(x)
    rejects.append(x)

for r in medium:
    sid = r["staging_id"]
    x = dict(resolved_by_id[sid])
    x["semantic_final_status"] = "QUARANTINED"
    x["human_semantic_decision"] = ""

    if sid in RECOVERY:
        x["assistant_final_semantic_decision"] = "NEEDS_EMBEDDED_PROGRAM_RECOVERY_REVIEW"
        x["assistant_final_semantic_note"] = (
            "Source row itself is not a canonical Program title, but it contains "
            "one or more plausible academic program names. Keep quarantined; later "
            "extract only after parent-level canonical-name deduplication."
        )
        x["embedded_program_recovery_hint"] = RECOVERY[sid]
        recovery.append(x)
    else:
        x["assistant_final_semantic_decision"] = "RECOMMEND_REJECT_AS_NON_PROGRAM"
        x["assistant_final_semantic_note"] = (
            "MEDIUM semantic review completed: row is eligibility, scholarship, "
            "marketing, news, exam, service, descriptive, or administrative prose "
            "rather than a canonical academic Program title."
        )
        x["embedded_program_recovery_hint"] = ""
        rejects.append(x)

    quarantine.append(x)

def write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

clean_path = out_dir / "program_direct_clean_1438.csv"
quarantine_path = out_dir / "program_semantic_quarantine_104.csv"
reject_path = out_dir / "program_semantic_reject_recommendations_92.csv"
recovery_path = out_dir / "program_embedded_recovery_review_12.csv"
manifest_path = out_dir / "PROGRAM_SEMANTIC_FINALIZATION_MANIFEST.json"

write_csv(clean_path, base_fields, clean)
write_csv(quarantine_path, out_fields, quarantine)
write_csv(reject_path, out_fields, rejects)
write_csv(recovery_path, out_fields, recovery)

checks = {
    "resolved_input_1542": len(resolved) == 1542,
    "high_input_47": len(high) == 47,
    "medium_input_57": len(medium) == 57,
    "quarantine_104": len(quarantine) == 104,
    "direct_clean_1438": len(clean) == 1438,
    "reject_recommendations_92": len(rejects) == 92,
    "embedded_recovery_review_12": len(recovery) == 12,
    "partition_reconstructs_1542": len(clean) + len(quarantine) == 1542,
    "no_clean_quarantine_overlap":
        not ({r["staging_id"] for r in clean} & {r["staging_id"] for r in quarantine}),
    "all_quarantine_human_decisions_blank":
        all(not (r.get("human_semantic_decision") or "").strip() for r in quarantine),
}

hard_stops = [k for k, v in checks.items() if not v]

manifest = {
    "status": "PASS_PROGRAM_SEMANTIC_FINALIZATION" if not hard_stops else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "resolvedInputRows": len(resolved),
    "highRows": len(high),
    "mediumRows": len(medium),
    "directCleanRows": len(clean),
    "semanticQuarantineRows": len(quarantine),
    "recommendRejectAsNonProgram": len(rejects),
    "embeddedProgramRecoveryReviewRows": len(recovery),
    "humanDecisionsChanged": 0,
    "autoDeletePerformed": False,
    "databaseWritePerformed": False,
    "importPolicy": {
        "directCleanRowsMayProceedToFurtherReadOnlyValidation": True,
        "quarantineRowsImportAllowed": False,
        "recoveryRowsImportAllowedBeforeDedupReview": False,
        "verifiedPublicationAllowed": False,
    },
    "checks": checks,
    "hardStopReasons": hard_stops,
    "files": {
        "directClean": clean_path.name,
        "semanticQuarantine": quarantine_path.name,
        "rejectRecommendations": reject_path.name,
        "embeddedRecoveryReview": recovery_path.name,
    },
}

manifest_path.write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

print("========================================")
print("PROGRAM SEMANTIC FINALIZATION - ALL ROWS")
print("========================================")
print(json.dumps(manifest, indent=2, ensure_ascii=False))
print()
print("RECOVERY REVIEW HINTS")
for r in recovery:
    print(
        f"- {r['staging_id']} | {r['parent_source_record_id']} | "
        f"{r['embedded_program_recovery_hint']}"
    )
print()
print("FILES")
print(clean_path)
print(quarantine_path)
print(reject_path)
print(recovery_path)
print(manifest_path)
print()
print("NO DATABASE CHANGES MADE")

if hard_stops:
    raise SystemExit(2)
