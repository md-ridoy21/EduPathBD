#!/usr/bin/env python3
import csv, html, os, re, ssl, time, sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT=Path(os.environ.get("EDUPATH_PHASE2_OUTPUT", str(Path.home()/"Downloads"/"EduPath-Admission-Intelligence-20260923"))).expanduser()
HERE=Path(__file__).resolve().parent
TARGETS=HERE/"ugc_institution_targets.csv"
OUT=ROOT/"ugc_university_discovery.csv"
RAW=ROOT/"raw-ugc-sites"; RAW.mkdir(parents=True,exist_ok=True)
CTX=ssl._create_unverified_context(); UA="Mozilla/5.0 EduPathOfficialDataCollector/1.0"
KEYS=["admission","admissions","apply","program","programme","academic","department","scholarship","financial aid","tuition","fee","ভর্তি","প্রোগ্রাম","বিভাগ","বৃত্তি","ফি"]
COMMON=["admission","admissions","apply","academic","academics","programs","programmes","scholarship","financial-aid"]

class P(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self.h=None; self.t=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a": self.h=dict(attrs).get("href"); self.t=[]
    def handle_data(self,d):
        if self.h is not None: self.t.append(d)
    def handle_endtag(self,tag):
        if tag.lower()=="a" and self.h is not None:
            self.links.append((self.h," ".join("".join(self.t).split()))); self.h=None; self.t=[]

def fetch(u):
    req=Request(u,headers={"User-Agent":UA})
    with urlopen(req,context=CTX,timeout=12) as r: return r.geturl(),r.read().decode("utf-8",errors="replace")

def norm_host(u): return (urlparse(u).hostname or "").lower().removeprefix("www.")
def hits(s):
    l=s.lower(); return sorted({k for k in KEYS if k.lower() in l})
def parse(text,base):
    p=P(); p.feed(text); out=[]
    for h,t in p.links:
        if not h or h.startswith(("javascript:","mailto:","tel:","#")): continue
        u=urljoin(base,html.unescape(h)); out.append((u,html.unescape(t)))
    return out

def write(rows):
    fields=["canonical_record_id","institution_name","ugc_category","website","discovered_url","link_text","keyword_hits","discovery_method","retrieved_at","review_status","error"]
    OUT.parent.mkdir(parents=True,exist_ok=True)
    with OUT.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)

def main():
    with TARGETS.open(encoding="utf-8-sig") as f: targets=list(csv.DictReader(f))
    rows=[]; done=0
    for i,r in enumerate(targets,1):
        site=(r.get("website") or "").strip()
        base_row={k:r[k] for k in ["canonical_record_id","institution_name","ugc_category","website"]}
        if not site:
            rows.append({**base_row,"discovered_url":"","link_text":"","keyword_hits":"","discovery_method":"NO_WEBSITE","retrieved_at":datetime.now(timezone.utc).isoformat(),"review_status":"PENDING","error":"UGC row has no website"}); continue
        try:
            eff,text=fetch(site); host=norm_host(eff)
            (RAW/(re.sub(r'[^A-Za-z0-9_-]+','_',r['canonical_record_id'])+".html")).write_text(text,encoding="utf-8")
            found=[]
            for u,t in parse(text,eff):
                hs=hits(t+" "+u)
                if hs and norm_host(u)==host: found.append((u,t,hs,"HOMEPAGE_LINK"))
            if not found:
                for p in COMMON:
                    u=urljoin(eff.rstrip('/')+'/',p)
                    try:
                        peff,ptext=fetch(u)
                        title=re.search(r'<title[^>]*>(.*?)</title>',ptext,re.I|re.S)
                        label=re.sub(r'<[^>]+>',' ',title.group(1)).strip() if title else p
                        hs=hits(label+" "+peff)
                        if len(ptext)>500 and hs: found.append((peff,label,hs,"COMMON_PATH_PROBE"))
                    except Exception: pass
            seen=set()
            for u,t,hs,m in found:
                if u in seen: continue
                seen.add(u)
                rows.append({**base_row,"discovered_url":u,"link_text":t,"keyword_hits":"|".join(hs),"discovery_method":m,"retrieved_at":datetime.now(timezone.utc).isoformat(),"review_status":"PENDING_REVIEW","error":""})
            if not found:
                rows.append({**base_row,"discovered_url":eff,"link_text":"","keyword_hits":"","discovery_method":"HOMEPAGE_ONLY","retrieved_at":datetime.now(timezone.utc).isoformat(),"review_status":"PENDING_MANUAL_DISCOVERY","error":"No admission/program/scholarship link auto-discovered"})
        except Exception as e:
            rows.append({**base_row,"discovered_url":"","link_text":"","keyword_hits":"","discovery_method":"FETCH_FAILED","retrieved_at":datetime.now(timezone.utc).isoformat(),"review_status":"PENDING","error":str(e)[:240]})
        done+=1
        if i%20==0: print(f"UGC discovery {i}/{len(targets)}")
        time.sleep(0.2)
    write(rows); print("UGC discovery rows:",len(rows),"->",OUT)

if __name__=="__main__": main()
