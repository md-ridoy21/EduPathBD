# EduPath BD — Official Data Review (2026-09-23)

This package reviews the user's collected official files and adds structured extracts/crawled data.
It is designed to prevent demo/stale data from being silently promoted to production.

## What is ready now

- **Current administrative master:** 499 upazilas, 64 districts, 8 divisions from Bangladesh National Portal.
- **BBS geocode source index:** 64 official district PDF links. Treat the BBS code documents as legacy code references and reconcile against the current National Portal hierarchy.
- **BANBEIS raw extraction:** 35,673 unique EIIN rows. This is useful for matching/reference, but the official PDF itself contains `C:\SURVEY2015\REPORT\LIST OF INSTITUTION`; do **not** treat it as a current 2026 production master.
- **BTEB uploaded snapshot:** 199 rows / 196 unique institute codes. Incomplete.
- **UGC current capture:** 182 university rows ({'cbhe': 1, 'international': 3, 'private': 117, 'public': 61}).
- **DGME current crawl:** 118 Medical/Dental rows (38 public, 80 private).
- **BNMC:** source discovered, row attachment still pending.
- **National University:** official total is 2,257 affiliated colleges/institutions, but the public college table is dynamic and did not expose rows to the text crawler.

## Production import rule

Do not bulk-import every CSV just because it is official. Use `SOURCE_MANIFEST.csv`.
Only datasets marked suitable for production should feed VERIFIED records.
Incomplete, legacy, dynamic-pending, or time-sensitive datasets must remain PENDING/reference until validated.

## Remaining automatic collection

No manual clicking is required for the remaining BTEB/BNMC attempt:

```bash
python3 -m pip install requests beautifulsoup4
python3 tools/fetch_remaining_official_data.py
```

For National University's dynamic table, run inside the EduPath project where Playwright already exists:

```bash
node tools/fetch_nu_colleges.mjs
```

After these files are captured, validate counts/duplicates before import.

## Suggested next app-data work

1. Normalize English/Bangla district/upazila aliases against `bd_admin_units_current_499.csv`.
2. Create source registry records for every imported institution.
3. Import UGC/DGME as PENDING first, then promote after source/link validation.
4. Keep BANBEIS 2015-era attachment as reference only until a current institution export is obtained.
5. Never seed current admission deadlines, fees, scholarships or admission rules from demo fixtures.
