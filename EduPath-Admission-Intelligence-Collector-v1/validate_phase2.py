#!/usr/bin/env python3
import csv, json, os
from collections import Counter
from pathlib import Path
ROOT=Path(os.environ.get("EDUPATH_PHASE2_OUTPUT", str(Path.home()/"Downloads"/"EduPath-Admission-Intelligence-20260923"))).expanduser()
def rows(p):
    p=ROOT/p
    if not p.exists(): return []
    with p.open(encoding='utf-8-sig') as f: return list(csv.DictReader(f))
notices=rows('central_notice_candidates.csv'); atts=rows('central_attachment_manifest.csv'); ugc=rows('ugc_university_discovery.csv'); facts=rows('fact_candidates.csv')
print('Central notice candidates:',len(notices))
print('Downloaded attachments:',sum(r.get('status')=='DOWNLOADED' for r in atts))
print('Attachment failures:',sum(r.get('status')=='FETCH_FAILED' for r in atts))
print('UGC discovery rows:',len(ugc))
print('UGC institutions represented:',len({r.get('canonical_record_id') for r in ugc if r.get('canonical_record_id')}))
print('Fact candidates:',len(facts))
print('Notices by authority:',dict(Counter(r.get('authority') for r in notices)))
block=[]
for sid in ['NU_ADMISSION_ARCHIVE','BTEB_ADMISSION','DGME_NOTICES','BNMC_NOTICES','DGNM_ORDERS','PMEAT_NOTICES']:
    if not any(r.get('source_id')==sid for r in notices): block.append('No notice candidate captured for '+sid)
if block:
    print('\nBLOCKERS/WARNINGS:')
    for b in block: print('-',b)
else: print('\nCentral source coverage: PASS candidate-discovery floor')
print('\nNOTE: candidates are NOT VERIFIED structured admission rules until attachment-level review/validation.')
