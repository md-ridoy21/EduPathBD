#!/usr/bin/env python3
import csv
import json
import sys
from collections import Counter
from pathlib import Path

if len(sys.argv) != 7:
    print(
        "Usage: python3 reconcile_ugc_program_phase.py "
        "<original1608.csv> <parentBlocked66.csv> <semantic104.csv> "
        "<strict141.csv> <unresolved89.csv> <output-dir>"
    )
    raise SystemExit(2)

orig = Path(sys.argv[1]).expanduser().resolve()
blocked = Path(sys.argv[2]).expanduser().resolve()
sem104 = Path(sys.argv[3]).expanduser().resolve()
strict141 = Path(sys.argv[4]).expanduser().resolve()
unresolved89 = Path(sys.argv[5]).expanduser().resolve()
out_dir = Path(sys.argv[6]).expanduser().resolve()
out_dir.mkdir(parents=True, exist_ok=True)

def read(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

original = read(orig)
parent_blocked = read(blocked)
semantic = read(sem104)
strict = read(strict141)
unresolved = read(unresolved89)

def ids(rows):
    return {r.get("staging_id","").strip() for r in rows if r.get("staging_id","").strip()}

orig_ids = ids(original)
b_ids = ids(parent_blocked)
s_ids = ids(semantic)
st_ids = ids(strict)
u_ids = ids(unresolved)

all_nonimport = b_ids | s_ids | st_ids | u_ids
overlaps = {
    "parentBlocked_semantic": len(b_ids & s_ids),
    "parentBlocked_strict": len(b_ids & st_ids),
    "parentBlocked_unresolved": len(b_ids & u_ids),
    "semantic_strict": len(s_ids & st_ids),
    "semantic_unresolved": len(s_ids & u_ids),
    "strict_unresolved": len(st_ids & u_ids),
}

reason_counts = Counter()
for r in unresolved:
    note = (r.get("salvage_note") or "").strip()
    if note:
        for part in [x.strip() for x in note.split("|") if x.strip()]:
            reason_counts[part] += 1

checks = {
    "original1608": len(original) == 1608,
    "parentBlocked66": len(parent_blocked) == 66,
    "semantic104": len(semantic) == 104,
    "strict141": len(strict) == 141,
    "unresolved89": len(unresolved) == 89,
    "allBucketsSubsetOriginal": all(x <= orig_ids for x in [b_ids,s_ids,st_ids,u_ids]),
    "noBucketOverlap": all(v == 0 for v in overlaps.values()),
    "nonImportedTotal400": len(all_nonimport) == 400,
    "importedImplied1208": len(orig_ids - all_nonimport) == 1208,
    "reconstructs1608": len(all_nonimport) + len(orig_ids - all_nonimport) == 1608,
}

hard = [k for k,v in checks.items() if not v]

manifest = {
    "status": "PASS_UGC_PROGRAM_PHASE_RECONCILIATION" if not hard else "HARD_STOP",
    "mode": "FILES_ONLY_NO_DB_WRITES",
    "dbChanges": False,
    "originalRows": len(original),
    "importedRowsImplied": len(orig_ids - all_nonimport),
    "nonImportedRows": len(all_nonimport),
    "buckets": {
        "parentPolicyBlocked": len(parent_blocked),
        "semanticQuarantineEarlier": len(semantic),
        "strictSemanticQuarantine": len(strict),
        "sourceEvidenceUnresolved": len(unresolved),
    },
    "overlaps": overlaps,
    "unresolvedReasonCounts": dict(reason_counts.most_common()),
    "checks": checks,
    "hardStopReasons": hard,
}

(out_dir / "UGC_PROGRAM_PHASE_RECONCILIATION.json").write_text(
    json.dumps(manifest, indent=2, ensure_ascii=False),
    encoding="utf-8"
)

with (out_dir / "ugc_program_unresolved_89_grouped.csv").open("w", encoding="utf-8", newline="") as f:
    fields = list(unresolved[0].keys()) if unresolved else []
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(unresolved)

print(json.dumps(manifest, indent=2, ensure_ascii=False))
print("\nNO DATABASE CHANGES MADE")
if hard:
    raise SystemExit(2)
