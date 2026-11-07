#!/usr/bin/env python3
import csv
import html
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

if len(sys.argv) != 3:
    print("Usage: python3 ugc_portal_program_salvage.py <program_official_source_review.csv> <output-dir>")
    raise SystemExit(2)

INPUT = Path(sys.argv[1]).expanduser().resolve()
OUT = Path(sys.argv[2]).expanduser().resolve()
OUT.mkdir(parents=True, exist_ok=True)

UGC_BASE = "https://www.ugc-universities.gov.bd"
DETAIL_MAX_ID = 220
UA = "EduPath-BD-UGC-Audit/1.1 (+authoritative-source-validation)"

DEGREE_HINT = re.compile(
    r"\b("
    r"b\.?\s?sc|m\.?\s?sc|bsc|msc|bba|mba|emba|ba|ma|bss|mss|"
    r"ll\.?\s?b|llb|ll\.?\s?m|llm|b\.?\s?pharm|bpharm|m\.?\s?pharm|mpharm|"
    r"b\.?\s?arch|barch|m\.?\s?arch|march|ph\.?\s?d|phd|m\.?\s?phil|mphil|"
    r"bachelor|master|doctor|diploma|certificate|dvm|mbbs|bds|mph|med|bed|"
    r"engineering|honours|honors"
    r")\b",
    re.I,
)

STOP = {
    "in","of","and","the","a","an","for","to","on","with","program","programme",
    "degree","hons","honours","honors","science","arts","engineering","technology"
}

def clean(s):
    return str(s or "").strip()

def norm_name(s):
    s = html.unescape(clean(s)).lower()
    s = s.replace("&", " and ")
    s = re.sub(r"\(\s*\d+\s*\)\s*$", "", s)
    s = re.sub(r"\*\s*$", "", s)
    s = re.sub(r"\buniversity of science & technology\b", "university of science and technology", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def canon_program(s):
    s = html.unescape(clean(s)).lower()
    repl = [
        (r"\bbachelor of science\b", "bsc"),
        (r"\bmaster of science\b", "msc"),
        (r"\bbachelor of business administration\b", "bba"),
        (r"\bmaster of business administration\b", "mba"),
        (r"\bexecutive master of business administration\b", "emba"),
        (r"\bbachelor of arts\b", "ba"),
        (r"\bmaster of arts\b", "ma"),
        (r"\bbachelor of social science[s]?\b", "bss"),
        (r"\bmaster of social science[s]?\b", "mss"),
        (r"\bbachelor of laws?\b", "llb"),
        (r"\bmaster of laws?\b", "llm"),
        (r"\bbachelor of pharmacy\b", "bpharm"),
        (r"\bmaster of pharmacy\b", "mpharm"),
        (r"\bbachelor of architecture\b", "barch"),
        (r"\bmaster of architecture\b", "march"),
        (r"\bdoctor of philosophy\b", "phd"),
    ]
    for a,b in repl:
        s = re.sub(a,b,s)
    s = re.sub(r"\bb\s*\.\s*sc\s*\.?", "bsc", s)
    s = re.sub(r"\bm\s*\.\s*sc\s*\.?", "msc", s)
    s = re.sub(r"\bll\s*\.\s*b\s*\.?", "llb", s)
    s = re.sub(r"\bll\s*\.\s*m\s*\.?", "llm", s)
    s = re.sub(r"\bph\s*\.\s*d\s*\.?", "phd", s)
    s = re.sub(r"\bm\s*\.\s*phil\s*\.?", "mphil", s)
    s = re.sub(r"\bhonours?\b|\bhons\b", "hons", s)
    s = re.sub(r"\bprogramme\b", "program", s)
    s = re.sub(r"\brevised\b", "", s)
    s = re.sub(r"\(\s*\d+\s*years?\s*\)", " ", s)
    s = re.sub(r"\b\d+\s*years?\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def tokset(s):
    return {t for t in canon_program(s).split() if len(t) >= 2 and t not in STOP}

def sim(a,b):
    ca, cb = canon_program(a), canon_program(b)
    if not ca or not cb:
        return 0.0, 0.0
    seq = SequenceMatcher(None, ca, cb).ratio()
    ta, tb = tokset(a), tokset(b)
    jac = (len(ta & tb) / len(ta | tb)) if (ta | tb) else 0.0
    return seq, jac

def host(url):
    try:
        return urlparse(url if "://" in url else "https://" + url).hostname.lower().removeprefix("www.")
    except Exception:
        return ""

def same_host(a,b):
    x,y = host(a),host(b)
    return bool(x and y and (x==y or x.endswith("."+y) or y.endswith("."+x)))

def fetch(url, timeout=14):
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})
    try:
        with urlopen(req, timeout=timeout) as r:
            raw = r.read(3_000_000)
            ctype = r.headers.get_content_type()
            charset = r.headers.get_content_charset() or "utf-8"
            text = raw.decode(charset, errors="replace") if ctype.startswith("text/") or "html" in ctype else ""
            return {
                "ok": 200 <= getattr(r, "status", 200) < 400,
                "status": getattr(r, "status", 200),
                "url": r.geturl(),
                "ctype": ctype,
                "html": text,
                "error": "",
            }
    except Exception as e:
        return {"ok":False,"status":0,"url":url,"ctype":"","html":"","error":str(e)}

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text_parts=[]
        self.links=[]
        self.h1=[]
        self._in_h1=False
        self._li_depth=0
        self._li=[]
        self.lis=[]
        self._tr=False
        self._cell=False
        self._cell_buf=[]
        self._cells=[]
        self.rows=[]

    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=="h1":
            self._in_h1=True
        if tag=="a":
            href=attrs.get("href")
            if href:
                self.links.append(href)
        if tag=="li":
            self._li_depth += 1
            if self._li_depth == 1:
                self._li=[]
        if tag=="tr":
            self._tr=True
            self._cells=[]
        if tag in ("td","th") and self._tr:
            self._cell=True
            self._cell_buf=[]

    def handle_endtag(self, tag):
        if tag=="h1":
            self._in_h1=False
        if tag=="li" and self._li_depth:
            if self._li_depth == 1:
                s=" ".join(self._li)
                s=re.sub(r"\s+"," ",s).strip()
                if s: self.lis.append(s)
            self._li_depth -= 1
        if tag in ("td","th") and self._cell:
            s=" ".join(self._cell_buf)
            s=re.sub(r"\s+"," ",s).strip()
            self._cells.append(s)
            self._cell=False
        if tag=="tr" and self._tr:
            if self._cells:
                self.rows.append(self._cells[:])
            self._tr=False
            self._cells=[]

    def handle_data(self, data):
        s=data.strip()
        if not s: return
        self.text_parts.append(s)
        if self._in_h1:
            self.h1.append(s)
        if self._li_depth:
            self._li.append(s)
        if self._cell:
            self._cell_buf.append(s)

    @property
    def text(self):
        return re.sub(r"\s+"," "," ".join(self.text_parts)).strip()

def parse_page(page):
    p=Parser()
    try: p.feed(page)
    except Exception: pass
    return p

def extract_website(parser):
    # Prefer a table row explicitly labelled Website.
    for row in parser.rows:
        if not row: continue
        if norm_name(row[0]) == "website" and len(row) >= 2:
            val=clean(row[1])
            if val:
                if not re.match(r"^https?://", val, re.I):
                    val="https://"+val.lstrip("/")
                return val
    # Fallback from page text.
    m=re.search(r"\bWebsite\s+((?:https?://)?(?:www\.)?[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:/[^\s]*)?)", parser.text, re.I)
    if m:
        val=m.group(1)
        if not re.match(r"^https?://", val, re.I):
            val="https://"+val
        return val
    return ""

def detail_record(i):
    url=f"{UGC_BASE}/university-detail/{i}"
    r=fetch(url)
    if not r["ok"] or not r["html"]:
        return None
    p=parse_page(r["html"])
    title=" ".join(p.h1).strip()
    if not title or norm_name(title) in {"hello world","university grants commission of bangladesh"}:
        return None
    fac=[]
    for href in p.links:
        if "/faculty-detail/" in href:
            fac.append(urljoin(UGC_BASE, href))
    fac=list(dict.fromkeys(fac))
    return {
        "id": i,
        "name": title,
        "nameNorm": norm_name(title),
        "url": url,
        "website": extract_website(p),
        "facultyUrls": fac,
        "detailLis": p.lis,
    }

def faculty_record(url):
    r=fetch(url)
    if not r["ok"] or not r["html"]:
        return {"url":url,"ok":False,"title":"","degrees":[],"error":r["error"] or str(r["status"])}
    p=parse_page(r["html"])
    title=" ".join(p.h1).strip()
    deg=[]
    for li in p.lis:
        t=re.sub(r"\s+"," ",li).strip(" -*•\t")
        if DEGREE_HINT.search(t) and len(t) <= 180:
            if "contact us" not in t.lower():
                deg.append(t)
    # Fallback: lines around "Degree offered" from flattened text.
    txt=p.text
    if "Degree offered" in txt:
        after=txt.split("Degree offered",1)[1]
        # capture modest phrases separated by approval-date patterns
        chunks=re.split(r"\[?Date of Approval|Contact Us|Faculty of|Department of", after, flags=re.I)
        for c in chunks[:100]:
            c=re.sub(r"\s+"," ",c).strip(" :;-")
            if DEGREE_HINT.search(c) and 4 <= len(c) <= 180:
                deg.append(c)
    seen=set()
    out=[]
    for d in deg:
        k=canon_program(d)
        if k and k not in seen:
            seen.add(k); out.append(d)
    return {"url":url,"ok":True,"title":title,"degrees":out,"error":""}

with INPUT.open("r", encoding="utf-8-sig", newline="") as f:
    rows=list(csv.DictReader(f))
    fields=list(rows[0].keys()) if rows else []

if not rows:
    raise SystemExit("ERROR: input review CSV is empty")

print(f"Crawling UGC university-detail/1..{DETAIL_MAX_ID} ...")
details=[]
with ThreadPoolExecutor(max_workers=12) as ex:
    futs={ex.submit(detail_record,i):i for i in range(1,DETAIL_MAX_ID+1)}
    for fut in as_completed(futs):
        rec=fut.result()
        if rec: details.append(rec)

details.sort(key=lambda x:x["id"])
print("UGC university detail records found =", len(details))

by_norm={}
for d in details:
    by_norm.setdefault(d["nameNorm"],[]).append(d)

parent_names=sorted({clean(r.get("institution_name")) for r in rows if clean(r.get("institution_name"))})
parent_match={}
ambiguous=[]
unmatched=[]

for name in parent_names:
    n=norm_name(name)
    exact=by_norm.get(n,[])
    if len(exact)==1:
        parent_match[name]=exact[0]
        continue
    scored=sorted(
        [(SequenceMatcher(None,n,d["nameNorm"]).ratio(),d) for d in details],
        key=lambda x:x[0],
        reverse=True
    )
    if scored and scored[0][0] >= 0.96 and (len(scored)==1 or scored[0][0]-scored[1][0] >= 0.03):
        parent_match[name]=scored[0][1]
    elif scored and scored[0][0] >= 0.90:
        ambiguous.append({"institution":name,"bestScore":round(scored[0][0],3),"best":scored[0][1]["name"]})
    else:
        unmatched.append(name)

matched_details={d["id"]:d for d in parent_match.values()}
faculty_urls=sorted({u for d in matched_details.values() for u in d["facultyUrls"]})
print("Matched parent institutions =", len(parent_match))
print("UGC faculty pages to crawl =", len(faculty_urls))

fac_records={}
with ThreadPoolExecutor(max_workers=12) as ex:
    futs={ex.submit(faculty_record,u):u for u in faculty_urls}
    for fut in as_completed(futs):
        rec=fut.result()
        fac_records[rec["url"]]=rec

for d in matched_details.values():
    degrees=[]
    for u in d["facultyUrls"]:
        fr=fac_records.get(u)
        if fr:
            for degree in fr["degrees"]:
                degrees.append({"name":degree,"facultyUrl":u})
    # also allow degree-like list items on university detail page
    for li in d["detailLis"]:
        if DEGREE_HINT.search(li) and len(li) <= 180:
            degrees.append({"name":li,"facultyUrl":d["url"]})
    uniq={}
    for item in degrees:
        k=canon_program(item["name"])
        if k and k not in uniq:
            uniq[k]=item
    d["degrees"]=list(uniq.values())

# Cache official university source pages only when domain is authoritative UGC-listed website.
source_urls=sorted({clean(r.get("program_source_url")) for r in rows if clean(r.get("program_source_url"))})
source_cache={}

def fetch_source(url):
    return url, fetch(url)

with ThreadPoolExecutor(max_workers=12) as ex:
    futs={ex.submit(fetch_source,u):u for u in source_urls}
    for fut in as_completed(futs):
        u,res=fut.result()
        source_cache[u]=res

extra=[
    "source_verification_status",
    "authoritative_evidence_tier",
    "authoritative_evidence_url",
    "authoritative_matched_program_name",
    "authoritative_match_score",
    "ugc_university_detail_url",
    "ugc_authoritative_website",
    "salvage_note",
]
out_fields=fields+[x for x in extra if x not in fields]

verified=[]
unresolved=[]
reason_counts={}

def add_reason(reason):
    reason_counts[reason]=reason_counts.get(reason,0)+1

for row in rows:
    x=dict(row)
    inst=clean(row.get("institution_name"))
    cand=clean(row.get("program_name"))
    d=parent_match.get(inst)
    status=""
    tier=""
    evurl=""
    matched=""
    score=0.0
    notes=[]

    if not d:
        notes.append("UGC_PARENT_NOT_CONFIDENTLY_MATCHED")
    else:
        cands=[]
        for item in d.get("degrees",[]):
            seq,jac=sim(cand,item["name"])
            cands.append((seq,jac,item))
        cands.sort(key=lambda z:(z[0],z[1]),reverse=True)

        if cands:
            best_seq,best_jac,best=cands[0]
            second_seq=cands[1][0] if len(cands)>1 else 0.0
            exact = canon_program(cand) == canon_program(best["name"])
            unique_strong = best_seq >= 0.94 and best_jac >= 0.80 and (best_seq-second_seq >= 0.03 or exact)

            if exact:
                status="PASS_STRONG"
                tier="UGC_APPROVED_DEGREE_EXACT"
                evurl=best["facultyUrl"]
                matched=best["name"]
                score=1.0
            elif unique_strong:
                status="PASS_STRONG"
                tier="UGC_APPROVED_DEGREE_STRONG_UNIQUE"
                evurl=best["facultyUrl"]
                matched=best["name"]
                score=best_seq

        if not status:
            # Fallback to authoritative university site domain as listed by UGC.
            auth_web=d.get("website","")
            src=clean(row.get("program_source_url"))
            fetched=source_cache.get(src)
            if auth_web and src.startswith("https://") and same_host(auth_web,src) and fetched and fetched["ok"] and fetched["html"]:
                p=parse_page(fetched["html"])
                page_norm=canon_program(p.text)
                cand_norm=canon_program(cand)
                t=tokset(cand)
                coverage=(sum(1 for z in t if z in set(page_norm.split()))/len(t)) if t else 0.0
                phrase=bool(cand_norm and cand_norm in page_norm)
                # Require stricter evidence than the previous verifier.
                if phrase or (len(cand.split()) <= 14 and coverage >= 0.90):
                    status="PASS_STRONG"
                    tier="UGC_DOMAIN_OFFICIAL_SITE_STRONG"
                    evurl=fetched["url"]
                    matched=cand
                    score=1.0 if phrase else coverage
                else:
                    notes.append("OFFICIAL_SITE_PROGRAM_EVIDENCE_WEAK")
            else:
                if not auth_web: notes.append("UGC_WEBSITE_MISSING")
                elif not same_host(auth_web,src): notes.append("SOURCE_DOMAIN_NOT_UGC_WEBSITE")
                elif not fetched or not fetched["ok"]: notes.append("OFFICIAL_SOURCE_FETCH_FAILED")
                else: notes.append("OFFICIAL_SOURCE_TEXT_UNAVAILABLE")

    if status=="PASS_STRONG":
        x["source_verification_status"]="PASS_STRONG"
        x["authoritative_evidence_tier"]=tier
        x["authoritative_evidence_url"]=evurl
        x["authoritative_matched_program_name"]=matched
        x["authoritative_match_score"]=f"{score:.3f}"
        x["ugc_university_detail_url"]=d["url"]
        x["ugc_authoritative_website"]=d.get("website","")
        x["salvage_note"]="Authoritative evidence found; DRAFT import only."
        verified.append(x)
    else:
        reason=" | ".join(notes) if notes else "NO_STRONG_AUTHORITATIVE_PROGRAM_MATCH"
        for part in notes or ["NO_STRONG_AUTHORITATIVE_PROGRAM_MATCH"]:
            add_reason(part)
        x["source_verification_status"]="REVIEW_REQUIRED"
        x["authoritative_evidence_tier"]=""
        x["authoritative_evidence_url"]=""
        x["authoritative_matched_program_name"]=""
        x["authoritative_match_score"]=""
        x["ugc_university_detail_url"]=d["url"] if d else ""
        x["ugc_authoritative_website"]=d.get("website","") if d else ""
        x["salvage_note"]=reason
        unresolved.append(x)

def write_csv(path,data,fields_):
    with path.open("w",encoding="utf-8",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields_)
        w.writeheader()
        w.writerows(data)

verified_path=OUT/"program_ugc_authoritative_salvage_pass.csv"
unresolved_path=OUT/"program_ugc_authoritative_unresolved.csv"
catalog_path=OUT/"ugc_authoritative_catalog.json"
manifest_path=OUT/"UGC_AUTHORITATIVE_SALVAGE_MANIFEST.json"

write_csv(verified_path,verified,out_fields)
write_csv(unresolved_path,unresolved,out_fields)

catalog={
    "ugcBase":UGC_BASE,
    "universityDetailRange":[1,DETAIL_MAX_ID],
    "universityRecords":[
        {
            "id":d["id"],"name":d["name"],"url":d["url"],"website":d.get("website",""),
            "facultyUrls":d.get("facultyUrls",[]),
            "degrees":d.get("degrees",[])
        } for d in details
    ]
}
catalog_path.write_text(json.dumps(catalog,indent=2,ensure_ascii=False),encoding="utf-8")

manifest={
    "status":"PASS_UGC_AUTHORITATIVE_SALVAGE_SPLIT",
    "mode":"NETWORK_READ_ONLY_NO_DB_WRITES",
    "dbWritesPerformed":False,
    "inputRows":len(rows),
    "ugcUniversityDetailRecordsFound":len(details),
    "inputParentNames":len(parent_names),
    "parentsMatchedToUgcDetail":len(parent_match),
    "parentsAmbiguous":len(ambiguous),
    "parentsUnmatched":len(unmatched),
    "ugcFacultyPagesCrawled":len(faculty_urls),
    "salvagePassStrongRows":len(verified),
    "unresolvedRows":len(unresolved),
    "reasonCounts":dict(sorted(reason_counts.items(), key=lambda kv:(-kv[1],kv[0]))),
    "policy":{
        "authoritativePrimary":"ugc-universities.gov.bd",
        "ugcDegreeExactOrStrongUniqueAccepted":True,
        "ugcListedUniversityWebsiteFallbackAcceptedOnlyWithStrongPageEvidence":True,
        "verificationStatusForImport":"DRAFT",
        "verifiedPublicationAllowed":False,
        "fakeOrInferredProgramCreationAllowed":False,
    },
    "checks":{
        "partitionReconstructsInput":len(verified)+len(unresolved)==len(rows),
        "allSalvageRowsAlreadyStrictSemanticPass":all(clean(r.get("strict_semantic_status"))=="PASS" for r in verified),
        "allSalvageRowsDraft":all(clean(r.get("verification_status"))=="DRAFT" for r in verified),
        "allSalvageRowsProductionVerifiedNo":all(clean(r.get("production_verified"))=="NO" for r in verified),
    },
    "samples":{
        "ambiguousParents":ambiguous[:20],
        "unmatchedParents":unmatched[:20],
    },
    "files":{
        "salvagePass":"program_ugc_authoritative_salvage_pass.csv",
        "unresolved":"program_ugc_authoritative_unresolved.csv",
        "ugcCatalog":"ugc_authoritative_catalog.json"
    }
}
manifest["hardStopReasons"]=[k for k,v in manifest["checks"].items() if not v]
if manifest["hardStopReasons"]:
    manifest["status"]="HARD_STOP"

manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding="utf-8")
print(json.dumps(manifest,indent=2,ensure_ascii=False))
print("\nNO DATABASE CHANGES MADE")
if manifest["status"]=="HARD_STOP":
    raise SystemExit(2)
