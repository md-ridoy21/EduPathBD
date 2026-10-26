# EduPath BD Official Data Collector v2

Run this toolkit **from the EduPath project root**, where `@playwright/test` is already installed. It writes directly into `~/Downloads/EduPath-Official-Data-2026-Reviewed-20260923` unless `DATA_DIR` is set.

It addresses the current data blockers:

1. **National University**: traverses paginated/dynamic College List instead of saving only the first visible page.
2. **BNMC**: targets the newer **14 June 2026 updated institution list**, published on the BNMC portal on 2 Sep 2026, and downloads exposed official attachments.
3. **BTEB 2026-27**: captures the current admission session's official institution/seat/policy links and any exposed tables.
4. **UGC**: walks official university detail pages and captures UGC Approved Faculties.

Run:

```bash
cd ~/Downloads/EduPath-BD-v1.0.0-rc.2
unzip -o ~/Downloads/EduPath-Official-Data-Collector-v2.zip -d ./official-data-collector-v2
cd official-data-collector-v2
npx playwright install chromium
./run_collectors.sh
```

Do not import these outputs into production until validation/reconciliation is complete. A non-zero collector creates diagnostics rather than silently marking data complete.
