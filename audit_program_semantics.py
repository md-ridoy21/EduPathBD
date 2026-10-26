#!/usr/bin/env python3
import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

if len(sys.argv) != 3:
    print("Usage: python3 audit_program_semantics.py <program_resolved_parent_draft_ready.csv> <output-dir>")
    raise SystemExit(2)

src = Path(sys.argv[1]).expanduser().resolve()
out_dir = Path(sys.argv[2]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

with src.open("r", encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
    fields = list(rows[0].keys()) if rows else []

HIGH_PATTERNS = [
    r"\bphotocopy\b",
    r"\bnational id\b",
    r"\bbirth certificate\b",
    r"\bpassport size\b",
    r"\bpassport-size\b",
    r"\bapplication form\b",
    r"\badmission form\b",
    r"\bapplication fee\b",
    r"\badmission fee\b",
    r"\btuition fee\b",
    r"\bfee structure\b",
    r"\brequired documents?\b",
    r"\bdocuments? required\b",
    r"\bmarksheet\b",
    r"\bmark sheet\b",
    r"\btestimonial\b",
    r"\btranscript\b",
    r"\bdownload form\b",
    r"\bonline application\b",
    r"\badmission requirements?\b",
    r"\beligibility requirements?\b",
]

MEDIUM_PATTERNS = [
    r"\badmission\b",
    r"\bapply\b",
    r"\bapplication\b",
    r"\bfee\b",
    r"\bfees\b",
    r"\brequirements?\b",
    r"\beligibility\b",
    r"\bnotice\b",
    r"\bcontact\b",
    r"\bdeadline\b",
    r"\bsemester fee\b",
    r"\bcredit fee\b",
    r"\bregistration fee\b",
    r"\bwaiver\b",
    r"\bscholarship\b",
    r"\bdocuments?\b",
]

DEGREE_HINTS = [
    r"\bb\.?\s?sc\b",
    r"\bm\.?\s?sc\b",
    r"\bbba\b",
    r"\bmba\b",
    r"\bba\b",
    r"\bma\b",
    r"\bbachelor\b",
    r"\bmaster\b",
    r"\bph\.?d\b",
    r"\bdoctor\b",
    r"\bdiploma\b",
    r"\bcertificate\b",
    r"\bllb\b",
    r"\bllm\b",
    r"\bbpharm\b",
    r"\bmpharm\b",
    r"\bengineering\b",
    r"\barchitecture\b",
    r"\benglish\b",
    r"\beconomics\b",
    r"\bbusiness\b",
    r"\bcomputer\b",
    r"\bcivil\b",
    r"\belectrical\b",
    r"\bmechanical\b",
    r"\bpharmacy\b",
    r"\blaw\b",
]

def norm(s):
    s = (s or "").strip().lower()
    s = re.sub(r"[_/|]+", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s

def matches_any(text, patterns):
    return [p for p in patterns if re.search(p, text, flags=re.I)]

flagged = []
reason_counts = Counter()
level_counts = Counter()
award_counts = Counter()

for row in rows:
    name = norm(row.get("program_name"))
    level = (row.get("degree_level") or "").strip()
    award = (row.get("degree_award") or "").strip()

    level_counts[level] += 1
    award_counts[award] += 1

    high = matches_any(name, HIGH_PATTERNS)
    medium = matches_any(name, MEDIUM_PATTERNS)
    degree_hints = matches_any(name, DEGREE_HINTS)

    reasons = []
    severity = ""

    if high:
        severity = "HIGH"
        reasons.append("HIGH_CONFIDENCE_NON_PROGRAM_TEXT")
        reasons.extend([f"pattern:{p}" for p in high])

    if not severity and medium and not degree_hints:
        severity = "MEDIUM"
        reasons.append("POSSIBLE_ADMISSION_OR_ADMIN_TEXT")
        reasons.extend([f"pattern:{p}" for p in medium])

    # Very long labels are often scraped prose/navigation rather than program titles.
    if len(name) >= 120:
        if not severity:
            severity = "MEDIUM"
        reasons.append("VERY_LONG_PROGRAM_NAME")

    # Sentence-like punctuation / connective prose signal.
    if re.search(r"\b(or|and/or|must|should|required|submit|copy of|please)\b", name) and not degree_hints:
        if not severity:
            severity = "MEDIUM"
        reasons.append("SENTENCE_LIKE_NON_PROGRAM_TEXT")

    if severity:
        out = dict(row)
        out["semantic_audit_severity"] = severity
        out["semantic_audit_reasons"] = " | ".join(reasons)
        out["assistant_semantic_recommendation"] = (
            "RECOMMEND_REJECT_AS_NON_PROGRAM"
            if severity == "HIGH"
            else "NEEDS_MANUAL_REVIEW"
        )
        flagged.append(out)
        reason_counts[severity] += 1

out_fields = fields + [
    "semantic_audit_severity",
    "semantic_audit_reasons",
    "assistant_semantic_recommendation",
]

flagged_path = out_dir / "program_semantic_flags.csv"
summary_path = out_dir / "PROGRAM_SEMANTIC_AUDIT_SUMMARY.json"

with flagged_path.open("w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=out_fields)
    w.writeheader()
    w.writerows(flagged)

summary = {
    "status": "REVIEW_REQUIRED" if flagged else "PASS_NO_SEMANTIC_FLAGS",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "inputRows": len(rows),
    "flaggedRows": len(flagged),
    "highConfidenceFlags": reason_counts.get("HIGH", 0),
    "mediumConfidenceFlags": reason_counts.get("MEDIUM", 0),
    "degreeLevelCounts": dict(level_counts),
    "degreeAwardTopCounts": dict(award_counts.most_common(30)),
    "policy": {
        "autoRejectPerformed": False,
        "humanDecisionPreserved": True,
        "databaseImportAllowedBeforeReview": False,
    },
    "files": {
        "flags": flagged_path.name,
    },
}

summary_path.write_text(
    json.dumps(summary, indent=2, ensure_ascii=False),
    encoding="utf-8",
)

print("========================================")
print("UGC PROGRAM SEMANTIC AUDIT")
print("========================================")
print(json.dumps(summary, indent=2, ensure_ascii=False))
print()
print("FIRST 30 FLAGS")
for i, r in enumerate(flagged[:30], 1):
    print(
        f"{i:02d}. [{r['semantic_audit_severity']}] "
        f"{r.get('parent_source_record_id')} | "
        f"{r.get('program_name')} | "
        f"{r['assistant_semantic_recommendation']}"
    )
print()
print("FILES")
print(flagged_path)
print(summary_path)
print()
print("NO DATABASE CHANGES MADE")
