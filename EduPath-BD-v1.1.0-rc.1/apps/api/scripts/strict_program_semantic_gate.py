#!/usr/bin/env python3
import csv
import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

if len(sys.argv) != 3:
    print("Usage: python3 strict_program_semantic_gate.py <input.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

EXPECTED_INPUT = 1438

ADMIN_PATTERNS = [
    r"\bread more\b",
    r"\bhereby\b",
    r"\badmission open\b",
    r"\bonline application\b",
    r"\bapplication form\b",
    r"\bapplication for\b",
    r"\bapply for\b",
    r"\bclick here\b",
    r"\btuition fee\b",
    r"\bfee structure\b",
    r"\bscholarship\b",
    r"\bwaiver\b",
    r"\bfinal exam\b",
    r"\bmid[- ]?term examination\b",
    r"\bexam(?:ination)? result\b",
    r"\bresult of\b",
    r"\bnotice\b",
    r"\bcircular\b",
    r"\brequired documents?\b",
    r"\badmission requirements?\b",
    r"\beligibility requirements?\b",
    r"\bmark ?sheet\b",
    r"\bmarksheet\b",
    r"\btranscript\b",
    r"\bbirth certificate\b",
    r"\bnational id\b",
    r"\bnid\b",
    r"\bregistration card\b",
    r"\bmigration\b",
    r"\bverification service\b",
    r"\bcertificate verification\b",
    r"\bpayment instructions?\b",
    r"\bcomplaint/?suggestions?\b",
    r"\bsemester fee\b",
    r"\bcredit fee\b",
    r"\bregistration fee\b",
    r"\bdeadline\b",
]

BAD_STARTS = [
    "all the students",
    "students who",
    "candidates ",
    "candidate ",
    "at masters level",
    "at least ",
    "for the requirement",
    "for ll.m",
    "for llm",
    "to help you",
    "begin your journey",
    "experience quality education",
    "graduates of",
    "join the ",
    "our services",
    "opportunities:",
    "special waivers",
    "general scholarships",
    "a student will",
    "they must",
    "the applicant",
    "renowned actor",
    "successful completion",
    "in addition to the required",
    "copy of ",
    "photocopy",
    "original transcript",
]

SENTENCE_TOKENS = {
    "students", "student", "candidates", "candidate", "must", "should", "will",
    "hereby", "required", "requires", "have", "has", "are", "is", "offers",
    "offered", "apply", "admitted", "completed", "completion", "passed",
    "eligible", "awarded", "held", "submitted", "submit", "provides", "get"
}

def norm(s):
    s = (s or "").strip().lower()
    s = s.replace("’", "'").replace("`", "'")
    s = re.sub(r"\s+", " ", s)
    return s

def reasons_for(row):
    name = norm(row.get("program_name"))
    reasons = []

    if not name:
        return ["EMPTY_PROGRAM_NAME"]

    if len(name) > 110:
        reasons.append("PROGRAM_NAME_TOO_LONG")

    words = re.findall(r"[a-z0-9]+", name)
    if len(words) >= 16 and SENTENCE_TOKENS.intersection(words):
        reasons.append("SENTENCE_LIKE_PROSE")

    if any(name.startswith(x) for x in BAD_STARTS):
        reasons.append("ADMIN_OR_PROSE_PREFIX")

    for pattern in ADMIN_PATTERNS:
        if re.search(pattern, name, flags=re.I):
            reasons.append("ADMIN_PATTERN:" + pattern)

    if re.search(r"(?:^|\s)20(?:2[4-9]|3\d)(?:\s|$|[.,;:/-])", name):
        reasons.append("DATE_OR_SESSION_TEXT")

    if "..." in name or "…" in name:
        reasons.append("TRUNCATED_UI_TEXT")

    # Explicit news/notice-style phrasing.
    if re.search(r"\b(batch|session|fall|summer|spring)\s*[-,:]?\s*20\d{2}\b", name):
        reasons.append("TERM_OR_BATCH_NOTICE_TEXT")

    if re.search(r"\bdepartment of\b.*\boffered courses\b", name):
        reasons.append("COURSE_OFFER_NOTICE")

    if re.search(r"\b(programs?|programme[s]?)\s+(are|is|will|have|has)\b", name):
        reasons.append("DESCRIPTIVE_PROGRAM_PROSE")

    # Obvious navigation/service text.
    if re.search(r"\b(service|services|download|request|guidelines?)\b", name) and \
       re.search(r"\b(certificate|transcript|verification|form|admission)\b", name):
        reasons.append("SERVICE_OR_NAVIGATION_TEXT")

    return sorted(set(reasons))

pass_rows = []
quarantine = []

extra = ["strict_semantic_status", "strict_semantic_reasons", "human_semantic_decision"]
out_fields = fields + [x for x in extra if x not in fields]

for row in rows:
    reasons = reasons_for(row)
    if reasons:
        x = dict(row)
        x["strict_semantic_status"] = "QUARANTINE"
        x["strict_semantic_reasons"] = " | ".join(reasons)
        x["human_semantic_decision"] = ""
        quarantine.append(x)
    else:
        x = dict(row)
        x["strict_semantic_status"] = "PASS"
        x["strict_semantic_reasons"] = ""
        x["human_semantic_decision"] = ""
        pass_rows.append(x)

def write_csv(path, rows_):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=out_fields)
        w.writeheader()
        w.writerows(rows_)

pass_path = out_dir / "program_strict_semantic_pass.csv"
quarantine_path = out_dir / "program_strict_semantic_quarantine.csv"
manifest_path = out_dir / "PROGRAM_STRICT_SEMANTIC_MANIFEST.json"

write_csv(pass_path, pass_rows)
write_csv(quarantine_path, quarantine)

raw = src.read_bytes()
manifest = {
    "status": "PASS_STRICT_SEMANTIC_GATE" if len(rows) == EXPECTED_INPUT else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputFile": str(src),
    "inputSha256": hashlib.sha256(raw).hexdigest(),
    "inputRows": len(rows),
    "strictPassRows": len(pass_rows),
    "strictQuarantineRows": len(quarantine),
    "humanDecisionsChanged": 0,
    "autoDeletePerformed": False,
    "verifiedPublicationPerformed": False,
    "checks": {
        "expectedInput1438": len(rows) == EXPECTED_INPUT,
        "partitionReconstructsInput": len(pass_rows) + len(quarantine) == len(rows),
        "allPassRowsDraft": all((r.get("verification_status") or "").strip() == "DRAFT" for r in pass_rows),
        "allPassRowsProductionVerifiedNo": all((r.get("production_verified") or "").strip() == "NO" for r in pass_rows),
        "allQuarantineHumanDecisionBlank": all(not (r.get("human_semantic_decision") or "").strip() for r in quarantine),
    },
    "files": {
        "strictPass": pass_path.name,
        "strictQuarantine": quarantine_path.name,
    }
}
manifest["hardStopReasons"] = [k for k,v in manifest["checks"].items() if not v]
if manifest["hardStopReasons"]:
    manifest["status"] = "HARD_STOP"

manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

print(json.dumps(manifest, indent=2, ensure_ascii=False))
print("\nFIRST 30 STRICT QUARANTINE ROWS")
for i, r in enumerate(quarantine[:30], 1):
    print(f"{i:02d}. {r.get('parent_source_record_id')} | {r.get('program_name')} | {r.get('strict_semantic_reasons')}")
print("\nNO DATABASE CHANGES MADE")

if manifest["status"] == "HARD_STOP":
    raise SystemExit(2)
