#!/usr/bin/env python3
import csv, hashlib, html, os, re, ssl, subprocess, sys, time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("EDUPATH_PHASE2_OUTPUT", str(Path.home()/"Downloads"/"EduPath-Admission-Intelligence-20260923"))).expanduser()
HERE = Path(__file__).resolve().parent
REGISTRY = HERE / "phase2_source_registry.csv"
RAW = ROOT / "raw-central"
ATT = ROOT / "attachments"
RAW.mkdir(parents=True, exist_ok=True)
ATT.mkdir(parents=True, exist_ok=True)

KEYWORDS = [
    "admission", "admit", "eligibility", "eligible", "deadline", "seat", "fee", "tuition", "scholarship", "fellowship", "stipend",
    "ভর্তি", "যোগ্যতা", "আবেদন", "সময়সীমা", "সময়সীমা", "ফি", "আসন", "বৃত্তি", "উপবৃত্তি", "ফেলোশিপ", "সহায়তা", "সহায়তা"
]
DOWNLOAD_EXTS = (".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".zip")
UA = "Mozilla/5.0 (X11; Linux x86_64) EduPathOfficialDataCollector/1.0"
CTX = ssl._create_unverified_context()  # government sites in this dataset have shown certificate-chain issues

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self._href=None; self._text=[]
    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            self._href = dict(attrs).get("href"); self._text=[]
    def handle_data(self, data):
        if self._href is not None: self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower()=="a" and self._href is not None:
            self.links.append((self._href, " ".join("".join(self._text).split())))
            self._href=None; self._text=[]

def safe_name(s, n=120):
    s=re.sub(r"[^A-Za-z0-9._-]+","_",s).strip("_")
    return (s[:n] or "item")

def fetch(url, timeout=45):
    req=Request(url,headers={"User-Agent":UA,"Accept":"*/*"})
    with urlopen(req, context=CTX, timeout=timeout) as r:
        return r.geturl(), r.headers, r.read()

def decode_body(data, headers):
    ct=headers.get("Content-Type","")
    m=re.search(r"charset=([^; ]+)",ct,re.I)
    enc=m.group(1) if m else "utf-8"
    try: return data.decode(enc,errors="replace")
    except Exception: return data.decode("utf-8",errors="replace")

def links_from(text, base):
    p=LinkParser(); p.feed(text)
    out=[]
    for href,label in p.links:
        if not href or href.startswith(("javascript:","mailto:","tel:","#")): continue
        out.append((urljoin(base, html.unescape(href)), html.unescape(label)))
    return out

def keyword_hits(s):
    low=s.lower(); return sorted({k for k in KEYWORDS if k.lower() in low})

def likely_detail(url,label):
    hits=keyword_hits(label+" "+url)
    return bool(hits) and not any(url.lower().split("?")[0].endswith(x) for x in DOWNLOAD_EXTS)

def is_download_candidate(url,label):
    path=urlparse(url).path.lower()
    return path.endswith(DOWNLOAD_EXTS) or any(x in label.lower() for x in ["download","ডাউনলোড","pdf","file ","ফাইল"])

def same_host(a,b):
    return urlparse(a).hostname == urlparse(b).hostname

def registry_rows():
    with REGISTRY.open(encoding="utf-8-sig",newline="") as f: return list(csv.DictReader(f))

def add_candidate(candidates, seen, row, title, detail_url, page_url, hits):
    key=(row['source_id'],detail_url,title)
    if key in seen: return
    seen.add(key)
    candidates.append({
        "source_id":row["source_id"],"authority":row["authority"],"title":title.strip(),
        "detail_url":detail_url,"discovered_on":page_url,"keyword_hits":"|".join(hits),
        "session_or_period":row["session_or_period"],"retrieved_at":datetime.now(timezone.utc).isoformat(),
        "review_status":"PENDING_REVIEW"
    })

def save_attachment(source_id, url, title, manifest, seen_att):
    if url in seen_att: return
    seen_att.add(url)
    try:
        eff, hdr, data = fetch(url, timeout=60)
    except Exception as e:
        manifest.append({"source_id":source_id,"title":title,"url":url,"effective_url":"","filename":"","content_type":"","bytes":"0","sha256":"","status":"FETCH_FAILED","error":str(e)[:240]})
        return
    ct=hdr.get("Content-Type","").split(";")[0].strip().lower()
    ext=Path(urlparse(eff).path).suffix.lower()
    if not ext or len(ext)>8:
        ext={"application/pdf":".pdf","application/msword":".doc","application/vnd.openxmlformats-officedocument.wordprocessingml.document":".docx","application/vnd.ms-excel":".xls","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":".xlsx","text/csv":".csv"}.get(ct,".bin")
    stem=safe_name(source_id+"_"+(title or Path(urlparse(eff).path).stem),100)
    folder=ATT/safe_name(source_id,60); folder.mkdir(parents=True,exist_ok=True)
    fn=folder/(stem+ext)
    n=2
    while fn.exists() and hashlib.sha256(fn.read_bytes()).hexdigest()!=hashlib.sha256(data).hexdigest():
        fn=folder/(f"{stem}_{n}{ext}"); n+=1
    fn.write_bytes(data)
    manifest.append({"source_id":source_id,"title":title,"url":url,"effective_url":eff,"filename":str(fn.relative_to(ROOT)),"content_type":ct,"bytes":str(len(data)),"sha256":hashlib.sha256(data).hexdigest(),"status":"DOWNLOADED","error":""})

def write_csv(path, rows, fields):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)

def main():
    candidates=[]; manifest=[]; report=[]; seen=set(); seen_att=set()
    for row in registry_rows():
        sid=row['source_id']; base=row['official_url']; pages=[base]
        if sid=="NU_ADMISSION_ARCHIVE": pages += [base+f"?arc_notice_page={i}" for i in range(2,9)]
        source_stats={"source_id":sid,"pages_attempted":0,"pages_ok":0,"candidate_count":0,"attachment_count_before":len(manifest),"errors":[]}
        for pi,page in enumerate(pages,1):
            source_stats['pages_attempted']+=1
            try:
                eff,hdr,data=fetch(page)
                source_stats['pages_ok']+=1
                text=decode_body(data,hdr)
                rawdir=RAW/safe_name(sid,60); rawdir.mkdir(parents=True,exist_ok=True)
                (rawdir/f"index_{pi:02d}.html").write_text(text,encoding="utf-8")
                for url,label in links_from(text,eff):
                    hits=keyword_hits(label+" "+url)
                    if is_download_candidate(url,label) and (hits or sid.startswith(("BTEB","DGME","BNMC","DGNM","PMEAT","UGC","SHED"))):
                        add_candidate(candidates,seen,row,label or Path(urlparse(url).path).name,url,eff,hits)
                        save_attachment(sid,url,label,manifest,seen_att)
                    elif likely_detail(url,label) and same_host(eff,url):
                        add_candidate(candidates,seen,row,label,url,eff,hits)
                        try:
                            deff,dh,db=fetch(url)
                            dtext=decode_body(db,dh)
                            dfn=rawdir/("detail_"+hashlib.sha1(url.encode()).hexdigest()[:12]+".html")
                            dfn.write_text(dtext,encoding="utf-8")
                            for au,al in links_from(dtext,deff):
                                if is_download_candidate(au,al):
                                    save_attachment(sid,au,al or label,manifest,seen_att)
                        except Exception as e:
                            source_stats['errors'].append(f"detail {url}: {e}"[:300])
            except Exception as e:
                source_stats['errors'].append(f"page {page}: {e}"[:300])
        source_stats['candidate_count']=sum(1 for x in candidates if x['source_id']==sid)
        source_stats['attachment_count_after']=len(manifest)
        source_stats['attachments_added']=source_stats['attachment_count_after']-source_stats['attachment_count_before']
        report.append(source_stats)
        print(f"{sid}: pages {source_stats['pages_ok']}/{source_stats['pages_attempted']}, candidates {source_stats['candidate_count']}, attachments +{source_stats['attachments_added']}")
        time.sleep(0.4)
    write_csv(ROOT/"central_notice_candidates.csv",candidates,["source_id","authority","title","detail_url","discovered_on","keyword_hits","session_or_period","retrieved_at","review_status"])
    write_csv(ROOT/"central_attachment_manifest.csv",manifest,["source_id","title","url","effective_url","filename","content_type","bytes","sha256","status","error"])
    import json
    (ROOT/"central_fetch_report.json").write_text(json.dumps({"generated_at":datetime.now(timezone.utc).isoformat(),"tls_verification_bypassed":True,"sources":report},ensure_ascii=False,indent=2),encoding="utf-8")
    print("Output:",ROOT)

if __name__=="__main__": main()
