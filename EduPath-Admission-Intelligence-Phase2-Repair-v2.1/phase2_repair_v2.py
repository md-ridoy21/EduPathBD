#!/usr/bin/env python3
from __future__ import annotations
import csv, hashlib, html, json, os, re, shutil, subprocess, sys, urllib.parse
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(os.environ.get(
    "EDUPATH_PHASE2_DIR",
    str(Path.home() / "Downloads" / "EduPath-Admission-Intelligence-20260923")
)).expanduser().resolve()

OUT = ROOT / "repair-v2"
RAW_BTEB = OUT / "raw-bteb"
BTEB_ATTACH = OUT / "bteb-attachments"
COMPACT = OUT / "compact-review-bundle"
for p in (OUT, RAW_BTEB, BTEB_ATTACH, COMPACT):
    p.mkdir(parents=True, exist_ok=True)

TODAY = datetime.now(timezone.utc).date().isoformat()

BTEB_PAGES = [
    ("BTEB_POLICY_2026_27",
     "https://bteb.gov.bd/pages/static-pages/6a91b5b9cb81efaf5dd0b863"),
    ("BTEB_NOTICE_2026_27_DIPLOMA_HSC_1",
     "https://bteb.gov.bd/pages/notices/%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AC-%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AD-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%AC%E0%A6%B0%E0%A7%8D%E0%A6%B7%E0%A7%87-%E0%A6%A1%E0%A6%BF%E0%A6%AA%E0%A7%8D%E0%A6%B2%E0%A7%8B%E0%A6%AE%E0%A6%BE-%E0%A6%93-%E0%A6%8F%E0%A6%87%E0%A6%9A%E0%A6%8F%E0%A6%B8%E0%A6%B8%E0%A6%BF-%E0%A6%AA%E0%A6%B0%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A7%9F%E0%A7%87%E0%A6%B0-%E0%A6%AC%E0%A6%BF%E0%A6%AD%E0%A6%BF%E0%A6%A8%E0%A7%8D%E0%A6%A8-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%95%E0%A7%8D%E0%A6%B0%E0%A6%AE%E0%A7%87%E0%A6%B0-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A5%E0%A7%80%E0%A6%A6%E0%A7%87%E0%A6%B0-%E0%A6%AD%E0%A6%B0%E0%A7%8D%E0%A6%A4%E0%A6%BF-%E0%A6%AC%E0%A6%BF%E0%A6%9C%E0%A7%8D%E0%A6%9E%E0%A6%BE%E0%A6%AA%E0%A7%8D%E0%A6%A4%E0%A6%BF-8xscff-6a900a2981a3682d0453abc7"),
    ("BTEB_NOTICE_2026_27_DIPLOMA_HSC_2",
     "https://bteb.gov.bd/pages/notices/%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AC-%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AD-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%AC%E0%A6%B0%E0%A7%8D%E0%A6%B7%E0%A7%87-%E0%A6%A1%E0%A6%BF%E0%A6%AA%E0%A7%8D%E0%A6%B2%E0%A7%8B%E0%A6%AE%E0%A6%BE-%E0%A6%93-%E0%A6%8F%E0%A6%87%E0%A6%9A%E0%A6%8F%E0%A6%B8%E0%A6%B8%E0%A6%BF-%E0%A6%AA%E0%A6%B0%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A7%9F%E0%A7%87%E0%A6%B0-%E0%A6%AC%E0%A6%BF%E0%A6%AD%E0%A6%BF%E0%A6%A8%E0%A7%8D%E0%A6%A8-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%95%E0%A7%8D%E0%A6%B0%E0%A6%AE%E0%A7%87-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%A5%E0%A7%80-%E0%A6%AD%E0%A6%B0%E0%A7%8D%E0%A6%A4%E0%A6%BF-%E0%A6%B8%E0%A6%82%E0%A6%95%E0%A7%8D%E0%A6%B0%E0%A6%BE%E0%A6%A8%E0%A7%8D%E0%A6%A4-%E0%A6%AC%E0%A6%BF%E0%A6%9C%E0%A7%8D%E0%A6%9E%E0%A6%BE%E0%A6%AA%E0%A7%8D%E0%A6%A4%E0%A6%BF-7qenwi-6a96634e1424e9094b30becf"),
    ("BTEB_CERTIFICATE_1YR_2026_27",
     "https://bteb.gov.bd/pages/notices/%E0%A7%A6%E0%A7%A7-%E0%A6%AC%E0%A6%9B%E0%A6%B0-%E0%A6%AE%E0%A7%87%E0%A7%9F%E0%A6%BE%E0%A6%A6%E0%A6%BF-%E0%A6%B8%E0%A6%BE%E0%A6%B0%E0%A7%8D%E0%A6%9F%E0%A6%BF%E0%A6%AB%E0%A6%BF%E0%A6%95%E0%A7%87%E0%A6%9F-%E0%A6%95%E0%A7%8B%E0%A6%B0%E0%A7%8D%E0%A6%B8-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%95%E0%A7%8D%E0%A6%B0%E0%A6%AE%E0%A7%87-%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AC-%E0%A7%A8%E0%A7%A6%E0%A7%A8%E0%A7%AD-%E0%A6%B6%E0%A6%BF%E0%A6%95%E0%A7%8D%E0%A6%B7%E0%A6%BE%E0%A6%AC%E0%A6%B0%E0%A7%8D%E0%A6%B7%E0%A7%87-%E0%A6%AD%E0%A6%B0%E0%A7%8D%E0%A6%A4%E0%A6%BF-%E0%A6%AC%E0%A6%BF%E0%A6%9C%E0%A7%8D%E0%A6%9E%E0%A6%BE%E0%A6%AA%E0%A7%8D%E0%A6%A4%E0%A6%BF-l6fhr7-6a12a3ae435e34d769cd188b"),
]

KEYWORDS = [
    "ভর্তি", "আবেদন", "যোগ্যতা", "জিপিএ", "gpa", "ssc", "hsc", "ফি", "fee",
    "আসন", "seat", "সময়সীমা", "সময়সীমা", "deadline", "তারিখ", "শিক্ষাবর্ষ",
    "diploma", "certificate", "ডিপ্লোমা", "সার্টিফিকেট"
]

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
        self._href=None
        self._txt=[]
    def handle_starttag(self, tag, attrs):
        if tag.lower()=="a":
            self._href=dict(attrs).get("href")
            self._txt=[]
    def handle_data(self, data):
        if self._href is not None:
            self._txt.append(data)
    def handle_endtag(self, tag):
        if tag.lower()=="a" and self._href is not None:
            self.links.append((self._href, " ".join("".join(self._txt).split())))
            self._href=None; self._txt=[]

def sha256(path: Path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

def magic(path: Path):
    try:
        b=path.read_bytes()[:16]
    except Exception:
        return "UNREADABLE"
    if b.startswith(b"%PDF"): return "PDF"
    if b.startswith(b"MZ"): return "PE_EXECUTABLE"
    if b.startswith(b"\x7fELF"): return "ELF_EXECUTABLE"
    if b.startswith(b"PK\x03\x04"): return "ZIP_LIKE"
    if b.startswith(b"\xd0\xcf\x11\xe0"): return "OLE_DOC"
    if b.lstrip().startswith(b"<"): return "HTML_XML"
    return "OTHER"

def run(cmd, *, check=False):
    p=subprocess.run(cmd, text=True, capture_output=True)
    if check and p.returncode:
        raise RuntimeError(f"{cmd}\n{p.stderr}")
    return p

def safe_name(url, fallback):
    name=Path(urllib.parse.urlparse(url).path).name
    name=urllib.parse.unquote(name) or fallback
    name=re.sub(r"[^A-Za-z0-9._-]+","_",name)
    return name[:180] or fallback

def fetch(url, out_path):
    cmd=["curl","-k","-L","--fail","--silent","--show-error","--max-time","60",
         "-A","Mozilla/5.0 EduPathDataCollector/2.0","-o",str(out_path),url]
    return run(cmd)

def inventory_attachments():
    rows=[]
    by_hash=defaultdict(list)
    attach=ROOT/"attachments"
    if not attach.exists():
        print(f"ERROR: attachments folder missing: {attach}")
        return [], {}
    for p in sorted(x for x in attach.rglob("*") if x.is_file()):
        rel=str(p.relative_to(ROOT))
        typ=magic(p)
        digest=sha256(p)
        by_hash[digest].append(rel)
        ext=p.suffix.lower()
        unsafe = typ in {"PE_EXECUTABLE","ELF_EXECUTABLE"} or ext in {".exe",".dll",".so",".bin"}
        rows.append({
            "path":rel,"bytes":p.stat().st_size,"sha256":digest,"magic_type":typ,
            "extension":ext,"unsafe_or_irrelevant":"YES" if unsafe else "NO",
            "action":"EXCLUDE_FROM_DATASET" if unsafe else "KEEP_RAW_EVIDENCE"
        })
    with (OUT/"attachment_inventory_v2.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0].keys()) if rows else [
            "path","bytes","sha256","magic_type","extension","unsafe_or_irrelevant","action"])
        w.writeheader(); w.writerows(rows)
    dups=[]
    for digest,paths in by_hash.items():
        if len(paths)>1:
            for path in paths:
                dups.append({"sha256":digest,"group_size":len(paths),"path":path})
    with (OUT/"duplicate_attachment_groups_v2.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=["sha256","group_size","path"])
        w.writeheader(); w.writerows(dups)
    unsafe=[r for r in rows if r["unsafe_or_irrelevant"]=="YES"]
    with (OUT/"unsafe_or_irrelevant_files_v2.csv").open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0].keys()) if rows else [
            "path","bytes","sha256","magic_type","extension","unsafe_or_irrelevant","action"])
        w.writeheader(); w.writerows(unsafe)
    return rows, by_hash

def collect_bteb():
    notice_rows=[]
    attachment_rows=[]
    fact_rows=[]
    seen_urls=set()

    for source_id,url in BTEB_PAGES:
        html_path=RAW_BTEB/f"{source_id}.html"
        p=fetch(url,html_path)
        if p.returncode:
            notice_rows.append({
                "source_id":source_id,"source_url":url,"retrieved_date":TODAY,
                "fetch_status":"FAILED","title_or_text":"","attachment_count":0,
                "notes":p.stderr.strip()[:500]
            })
            continue
        body=html_path.read_text("utf-8",errors="replace")
        title=""
        m=re.search(r"<title[^>]*>(.*?)</title>",body,re.I|re.S)
        if m: title=re.sub(r"<[^>]+>", " ", html.unescape(m.group(1))).strip()
        parser=LinkParser()
        try: parser.feed(body)
        except Exception: pass
        links=[]
        for href,txt in parser.links:
            if not href: continue
            absurl=urllib.parse.urljoin(url,href)
            low=absurl.lower()
            relevant = (
                any(x in low for x in [".pdf",".doc",".docx",".xls",".xlsx"]) or
                "objectstorage" in low or "download" in low
            )
            if relevant and absurl not in seen_urls:
                seen_urls.add(absurl); links.append((absurl,txt))
        notice_rows.append({
            "source_id":source_id,"source_url":url,"retrieved_date":TODAY,
            "fetch_status":"OK","title_or_text":title,"attachment_count":len(links),
            "notes":"Official BTEB source page"
        })
        for idx,(aurl,atxt) in enumerate(links,1):
            fname=safe_name(aurl,f"{source_id}_{idx}")
            out=BTEB_ATTACH/fname
            fp=fetch(aurl,out)
            if fp.returncode:
                attachment_rows.append({
                    "source_id":source_id,"source_page_url":url,"attachment_url":aurl,
                    "anchor_text":atxt,"local_path":"","bytes":0,"sha256":"",
                    "magic_type":"","download_status":"FAILED","retrieved_date":TODAY
                })
                continue
            typ=magic(out)
            if typ=="HTML_XML" and out.suffix.lower()==".pdf":
                # Keep evidence but do not mislabel as usable PDF.
                pass
            attachment_rows.append({
                "source_id":source_id,"source_page_url":url,"attachment_url":aurl,
                "anchor_text":atxt,"local_path":str(out.relative_to(ROOT)),
                "bytes":out.stat().st_size,"sha256":sha256(out),
                "magic_type":typ,"download_status":"OK","retrieved_date":TODAY
            })

    # extract BTEB fact candidates from official pages + downloaded PDFs
    candidates=[]
    for p in sorted(RAW_BTEB.glob("*.html")):
        text=re.sub(r"<script.*?</script>|<style.*?</style>"," ",p.read_text("utf-8",errors="replace"),flags=re.I|re.S)
        text=html.unescape(re.sub(r"<[^>]+>"," ",text))
        candidates.append((p.name,text))
    pdftotext=shutil.which("pdftotext")
    if pdftotext:
        for p in sorted(BTEB_ATTACH.iterdir()):
            if p.is_file() and magic(p)=="PDF":
                txt=p.with_suffix(p.suffix+".txt")
                proc=run([pdftotext,"-layout",str(p),str(txt)])
                if proc.returncode==0 and txt.exists():
                    candidates.append((p.name,txt.read_text("utf-8",errors="replace")))
    for source_name,text in candidates:
        compact=" ".join(text.split())
        # split rough sentence/window chunks
        for kw in KEYWORDS:
            for m in re.finditer(re.escape(kw),compact,re.I):
                start=max(0,m.start()-220); end=min(len(compact),m.end()+420)
                snippet=compact[start:end].strip()
                if len(snippet)>=40:
                    fact_rows.append({
                        "authority":"BTEB","source_name":source_name,"keyword":kw,
                        "candidate_text":snippet,"review_status":"PENDING_ATTACHMENT_REVIEW",
                        "retrieved_date":TODAY
                    })
                if len(fact_rows)>1500:
                    break
            if len(fact_rows)>1500: break
        if len(fact_rows)>1500: break

    def write_csv(path, rows, fields):
        with path.open("w",newline="",encoding="utf-8-sig") as f:
            w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)
    write_csv(OUT/"bteb_notice_candidates_v2.csv", notice_rows,
              ["source_id","source_url","retrieved_date","fetch_status","title_or_text","attachment_count","notes"])
    write_csv(OUT/"bteb_attachment_manifest_v2.csv", attachment_rows,
              ["source_id","source_page_url","attachment_url","anchor_text","local_path","bytes","sha256","magic_type","download_status","retrieved_date"])
    write_csv(OUT/"bteb_fact_candidates_v2.csv", fact_rows,
              ["authority","source_name","keyword","candidate_text","review_status","retrieved_date"])
    return notice_rows, attachment_rows, fact_rows

def make_compact_bundle():
    # Preserve compact root artifacts and repair reports; no hundreds of raw PDFs.
    root_files = [
        "central_attachment_manifest.csv",
        "central_fetch_report.json",
        "central_notice_candidates.csv",
        "fact_candidates.csv",
        "ugc_university_discovery.csv",
    ]
    for name in root_files:
        src=ROOT/name
        if src.exists():
            shutil.copy2(src,COMPACT/name)
    for name in [
        "attachment_inventory_v2.csv","duplicate_attachment_groups_v2.csv",
        "unsafe_or_irrelevant_files_v2.csv","bteb_notice_candidates_v2.csv",
        "bteb_attachment_manifest_v2.csv","bteb_fact_candidates_v2.csv"
    ]:
        src=OUT/name
        if src.exists(): shutil.copy2(src,COMPACT/name)
    # Add BTEB raw HTML and downloaded BTEB docs only (small focused evidence set).
    if RAW_BTEB.exists():
        shutil.copytree(RAW_BTEB,COMPACT/"raw-bteb",dirs_exist_ok=True)
    if BTEB_ATTACH.exists():
        shutil.copytree(BTEB_ATTACH,COMPACT/"bteb-attachments",dirs_exist_ok=True)

    # summary
    inv=list(csv.DictReader((OUT/"attachment_inventory_v2.csv").open(encoding="utf-8-sig"))) if (OUT/"attachment_inventory_v2.csv").exists() else []
    unsafe=[x for x in inv if x.get("unsafe_or_irrelevant")=="YES"]
    dup_groups={}
    for r in csv.DictReader((OUT/"duplicate_attachment_groups_v2.csv").open(encoding="utf-8-sig")) if (OUT/"duplicate_attachment_groups_v2.csv").exists() else []:
        dup_groups.setdefault(r["sha256"],0); dup_groups[r["sha256"]]+=1
    summary={
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_root": str(ROOT),
        "attachment_files_inventoried": len(inv),
        "unsafe_or_irrelevant_flagged": len(unsafe),
        "duplicate_sha256_groups": len(dup_groups),
        "bteb_source_pages": len(BTEB_PAGES),
        "note": "No existing raw evidence was deleted or modified. Unsafe files are only flagged/excluded from downstream dataset use."
    }
    (COMPACT/"REPAIR_V2_SUMMARY.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    readme = """# EduPath Phase-2 Repair v2 compact review bundle

This compact bundle is intended for review/upload. It intentionally excludes the hundreds of original attachments, except for the focused BTEB repair evidence.

Important:
- Existing Phase-2 raw evidence was not deleted or overwritten.
- Executables/non-data files are flagged in `unsafe_or_irrelevant_files_v2.csv`.
- SHA-256 duplicate groups are reported, not silently deleted.
- BTEB 2026-27 official policy/notices are fetched separately because the first collector missed them.
- Fact candidates remain PENDING and are not production-verified rules.
"""
    (COMPACT/"README.md").write_text(readme,encoding="utf-8")

    # checksum
    items=[]
    for p in sorted(x for x in COMPACT.rglob("*") if x.is_file() and x.name!="SHA256SUMS.txt"):
        items.append(f"{sha256(p)}  {p.relative_to(COMPACT)}")
    (COMPACT/"SHA256SUMS.txt").write_text("\n".join(items)+"\n",encoding="utf-8")

    zip_path=OUT/"EduPath-Phase2-Compact-Review-Bundle-v2.zip"
    if zip_path.exists(): zip_path.unlink()
    shutil.make_archive(str(zip_path.with_suffix("")),"zip",COMPACT)
    return zip_path, summary

def main():
    if not ROOT.exists():
        print(f"ERROR: Phase-2 output folder not found: {ROOT}")
        sys.exit(2)
    print("Phase-2 root:", ROOT)
    inv,_=inventory_attachments()
    notices,atts,facts=collect_bteb()
    zip_path,summary=make_compact_bundle()
    print("\n=== Repair v2 summary ===")
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    print("BTEB source-page records:", len(notices))
    print("BTEB downloaded attachment rows:", len(atts))
    print("BTEB fact candidates:", len(facts))
    print("Compact upload bundle:", zip_path)
    unsafe=[r for r in inv if r["unsafe_or_irrelevant"]=="YES"]
    if unsafe:
        print("\nWARNING: unsafe/irrelevant files were flagged (not deleted):")
        for r in unsafe[:20]:
            print(" -", r["path"], r["magic_type"], r["bytes"])
    print("\nNext: upload repair-v2/EduPath-Phase2-Compact-Review-Bundle-v2.zip")

if __name__=="__main__":
    main()
