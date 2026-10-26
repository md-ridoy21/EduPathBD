# EduPath Official Data Collector v3

This version fixes the exact failures observed in v2 on 2026-09-23:

- BNMC / UGC: Chromium `ERR_CERT_AUTHORITY_INVALID`
- BTEB: Chromium `ERR_CERT_COMMON_NAME_INVALID`
- NU: public College List renders table headers but no initial rows; v3 captures XHR/fetch traffic, tries public search/pagination, replays DataTables-style requests, and saves endpoint diagnostics instead of guessing.

## Security note

BNMC, BTEB and UGC collectors keep HTTPS URLs but set Playwright `ignoreHTTPSErrors` because those official government hosts produced certificate errors in the user's Chromium environment. The bypass is explicitly recorded in output metadata. Data collected through these hosts must retain its official source URL and should not be promoted to VERIFIED solely because the crawl succeeded.

## Run

Extract this ZIP directly into a new folder inside the EduPath project, then:

```bash
cd ~/Downloads/EduPath-BD-v1.0.0-rc.2/official-data-collector-v3
chmod +x run_collectors.sh
./run_collectors.sh
```

Playwright is already installed in the parent EduPath project. If Chromium is missing:

```bash
npx playwright install chromium
```

## Important

Do not delete the existing reviewed data folder. v3 writes into:

`~/Downloads/EduPath-Official-Data-2026-Reviewed-20260923`

NU v3 will not overwrite a larger existing CSV with a smaller failed result. If NU remains incomplete, send these diagnostics back:

- `07-nu/_diagnostics/nu_network_requests.json`
- `07-nu/_diagnostics/nu_response_samples.json`
- `07-nu/_diagnostics/nu_script_hints.json`
- `07-nu/_diagnostics/nu_page_text.txt`

That evidence exposes the portal's real public data path so the next fix can be endpoint-specific rather than speculative.
