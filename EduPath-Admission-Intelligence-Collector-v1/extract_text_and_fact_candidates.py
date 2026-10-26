#!/usr/bin/env python3
import csv, os, re, shutil, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(os.environ.get("EDUPATH_PHASE2_OUTPUT", str(Path.home()/"Downloads"/"EduPath-Admission-Intelligence-20260923"))).expanduser()
MAN=ROOT/"central_attachment_manifest.csv"
TXT=ROOT/"attachment-text"; TXT.mkdir(parents=True,exist_ok=True)
OUT=ROOT/"fact_candidates.csv"
KEYS={
 "eligibility":["যোগ্যতা","eligibility","eligible","gpa","জিপিএ","এসএসসি","এইচএসসি","ssc","hsc"],
 "deadline":["শেষ তারিখ","সময়সীমা","সময়সীমা","deadline","last date","আবেদনের সময়","আবেদনের সময়"],
 "fee":["আবেদন ফি","ভর্তি ফি","fee","টাকা","৳","tk"],
 "seat":["আসন","seat","seats"],
 "scholarship":["বৃত্তি","উপবৃত্তি","ফেলোশিপ","scholarship","stipend","fellowship","আর্থিক সহায়তা","আর্থিক সহায়তা"],
 "program":["প্রোগ্রাম","কোর্স","বিষয়","বিষয়","program","course","subject","curriculum"]
}

def snippets(text,needle,window=220):
    out=[]; low=text.lower(); n=needle.lower(); pos=0
    while True:
        i=low.find(n,pos)
        if i<0: break
        s=max(0,i-window); e=min(len(text),i+len(needle)+window)
        out.append(" ".join(text[s:e].split()))
        pos=i+len(n)
        if len(out)>=4: break
    return out

def main():
    if not MAN.exists(): print("Run collect_phase2_central.py first"); return 2
    pdftotext=shutil.which("pdftotext")
    facts=[]
    with MAN.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r['status']!='DOWNLOADED' or not r['filename'].lower().endswith('.pdf'): continue
            p=ROOT/r['filename']; out=TXT/(p.stem+'.txt')
            if pdftotext:
                subprocess.run([pdftotext,"-layout",str(p),str(out)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if not out.exists(): continue
            text=out.read_text(encoding='utf-8',errors='ignore')
            for typ,ks in KEYS.items():
                picked=[]
                for k in ks:
                    picked += snippets(text,k)
                    if len(picked)>=4: break
                for sn in picked[:4]:
                    facts.append({"source_id":r['source_id'],"attachment":r['filename'],"fact_type":typ,"snippet":sn,"source_url":r['effective_url'] or r['url'],"review_status":"PENDING_HUMAN_OR_RULE_VALIDATION"})
    fields=["source_id","attachment","fact_type","snippet","source_url","review_status"]
    with OUT.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(facts)
    print('Fact candidates:',len(facts),'->',OUT)

if __name__=='__main__': raise SystemExit(main() or 0)
