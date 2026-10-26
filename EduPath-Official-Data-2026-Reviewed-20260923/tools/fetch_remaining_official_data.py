#!/usr/bin/env python3
"""
EduPath BD official-data follow-up fetcher.
Run on a machine with normal Internet access:
  python3 tools/fetch_remaining_official_data.py
Requirements:
  pip install requests beautifulsoup4
This script never logs credentials and only accesses public pages.
"""
from pathlib import Path
import csv, re, time, requests
from bs4 import BeautifulSoup

OUT = Path(__file__).resolve().parents[1]
UA = {"User-Agent": "EduPathBD-OfficialDataCollector/1.0 (+educational project)"}

def save_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0]) if rows else ["status"]
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields); w.writeheader(); w.writerows(rows)

def fetch_bteb():
    base = "https://btebcbt.gov.bd/utility/instituteList"
    rows, seen = [], set()
    first_total = None
    for offset in range(0, 2000, 10):
        r = requests.get(base, params={"max":10,"offset":offset,"search":""}, headers=UA, timeout=45)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        text = soup.get_text(" ", strip=True)
        tm = re.search(r"Showing Record Total\s*:\s*(\d+)", text)
        if tm and first_total is None: first_total = int(tm.group(1))
        page_rows = []
        for tr in soup.select("table tr"):
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td","th"])]
            if len(cells) >= 8 and re.fullmatch(r"\d{4,7}", cells[0] or ""):
                item = {
                    "institute_code": cells[0], "institute_name": cells[1],
                    "address": cells[2], "mobile": cells[3], "eiin": cells[4],
                    "email": cells[5], "division": cells[6], "district": cells[7],
                    "source_url": base
                }
                key = (item["institute_code"], item["institute_name"], item["district"])
                if key not in seen:
                    seen.add(key); rows.append(item)
                page_rows.append(item)
        if not page_rows:
            break
        if first_total and len(rows) >= first_total:
            break
        time.sleep(0.35)
    save_csv(OUT/"03-bteb"/"bteb_full_live_crawl.csv", rows)
    print("BTEB", len(rows), "rows; first-page reported total:", first_total)

def fetch_bnmc_metadata():
    url = "https://bnmc.gov.bd/pages/miscellaneous-infos"
    r = requests.get(url, headers=UA, timeout=45); r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    candidates = []
    for a in soup.find_all("a", href=True):
        title = a.get_text(" ", strip=True)
        if "নার্সিং" in title and "মিডওয়াইফারি" in title and "প্রতিষ্ঠানের তালিকা" in title:
            candidates.append({"title":title,"detail_url":requests.compat.urljoin(url,a["href"])})
    save_csv(OUT/"06-bnmc"/"bnmc_discovered_list_pages.csv", candidates or [{"title":"No matching row exposed in static HTML","detail_url":url}])
    print("BNMC candidate pages:", len(candidates))

if __name__ == "__main__":
    fetch_bteb()
    fetch_bnmc_metadata()
