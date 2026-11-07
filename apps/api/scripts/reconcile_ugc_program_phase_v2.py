#!/usr/bin/env python3
import csv, json, sys
from pathlib import Path

if len(sys.argv) != 7:
    print("Usage: python3 reconcile_ugc_program_phase_v2.py <original1608.csv> <parent66.csv> <semantic104.csv> <strict141.csv> <unresolved89.csv> <out-dir>")
    raise SystemExit(2)

paths=[Path(x).expanduser().resolve() for x in sys.argv[1:6]]
out=Path(sys.argv[6]).expanduser().resolve()
out.mkdir(parents=True,exist_ok=True)

def read(p):
    with p.open("r",encoding="utf-8-sig",newline="") as f:
        return list(csv.DictReader(f))
def ids(rows):
    return {r.get("staging_id","").strip() for r in rows if r.get("staging_id","").strip()}

original,parent66,semantic104,strict141,unresolved89=[read(p) for p in paths]
O,B,S,T,U=map(ids,[original,parent66,semantic104,strict141,unresolved89])

overlaps={
    "parent66_semantic104":len(B&S),
    "parent66_strict141":len(B&T),
    "parent66_unresolved89":len(B&U),
    "semantic104_strict141":len(S&T),
    "semantic104_unresolved89":len(S&U),
    "strict141_unresolved89":len(T&U),
}
nonimport=B|S|T|U
implied_import=O-nonimport

checks={
    "original1608":len(original)==1608,
    "parent66":len(parent66)==66,
    "semantic104":len(semantic104)==104,
    "strict141":len(strict141)==141,
    "unresolved89":len(unresolved89)==89,
    "allBucketsSubsetOriginal":all(x<=O for x in [B,S,T,U]),
    "noBucketOverlap":all(v==0 for v in overlaps.values()),
    "nonImported400":len(nonimport)==400,
    "impliedImported1208":len(implied_import)==1208,
    "reconstructs1608":len(nonimport)+len(implied_import)==1608,
}
hard=[k for k,v in checks.items() if not v]
manifest={
    "status":"PASS_UGC_PROGRAM_PHASE_RECONCILIATION" if not hard else "HARD_STOP",
    "mode":"FILES_ONLY_NO_DB_WRITES",
    "dbChanges":False,
    "originalRows":len(original),
    "importedRowsImplied":len(implied_import),
    "nonImportedRows":len(nonimport),
    "buckets":{
        "parentPolicyBlocked":len(parent66),
        "semanticQuarantineEarlier":len(semantic104),
        "strictSemanticQuarantine":len(strict141),
        "sourceEvidenceUnresolved":len(unresolved89),
    },
    "overlaps":overlaps,
    "checks":checks,
    "hardStopReasons":hard
}
(out/"UGC_PROGRAM_PHASE_RECONCILIATION_V2.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(json.dumps(manifest,indent=2))
if hard: raise SystemExit(2)
