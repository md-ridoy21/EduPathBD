# EduPath Official Data Collector v4

Purpose: finish the institution-master evidence phase without silently promoting incomplete data.

This version addresses the v3 failures observed on 2026-09-23:
- BNMC: switches from DOM-only scraping to raw official HTML + multi-domain TLS-tolerant discovery and records metadata even when the latest attachment URL remains hidden.
- BTEB: downloads PDF links as files instead of navigating Chromium to a download response, and separately reconciles the live institute master against the site's reported total.
- UGC: probes official university-detail pages using `curl -k -L` rather than Chromium list-page discovery; maps results back to the already captured 182-university official master.
- NU: does not recrawl; audits the successful 2,294-row live capture for duplicate/blank codes and extracts any API total hints from existing diagnostics.

## Run

From this collector folder inside the EduPath project:

```bash
chmod +x run_collectors_v4.sh
./run_collectors_v4.sh
node validate_collected_data_v4.mjs
```

Requirements already present on the user's machine: Node.js, curl. `pdftotext` is optional but useful for BTEB PDF text extraction.

## Important

A green v4 institution-master gate still does **not** mean the entire EduPath production dataset is final. Current admission circulars, eligibility rules, application fees/deadlines, seat capacities, scholarships and program/subject mappings remain a separate second data phase.
