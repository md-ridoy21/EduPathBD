# EduPath Institution Master Reconciliation v2 - 2026-09-23

## Status

**Reconciled staging is complete; production verification is not complete.** The v2 master contains 3,648 authority-scoped records. No record was deleted merely to force a published headline count.

## BNMC

- Official 22-page 14 June 2026 institution PDF: **552 structural institution/program rows**.
- Embedded-font decoder recovered **552/552 nonblank names** and **550 exact-unique institution-name strings**.
- No OCR was used. Decoding uses the embedded Nikosh cmap, contextual glyph corrections and Bengali visual-to-logical ordering.
- Because some source spellings and a small number of contextual glyph interpretations may still require human review, BNMC remains `STAGING_DECODED_REQUIRES_SPOT_REVIEW`, not VERIFIED.

## BTEB

- Local dated capture: 509 source rows; duplicate-code reconciliation yields **504 staging candidates**.
- The public source's web-indexed pagination snapshots report different totals (504, 505, 510), while the local run reported 511. This demonstrates that a fixed total-equality gate is not stable enough to define row correctness.
- v2 therefore preserves row-level evidence and marks BTEB `STAGING_OFFICIAL_SNAPSHOT_SOURCE_COUNT_VOLATILE`. An atomic official export or repeatable snapshot is still needed for completeness verification.

## National University

- Official live college-list capture: **2294 rows / 2294 unique college codes**.
- Official static NU profile still states **2,257** colleges/institutions.
- There is no row-level status field in the captured live list that identifies a defensible set of exactly 37 rows to delete.
- All live rows are retained for discovery/search staging with `DISCOVERY_ELIGIBLE_AFFILIATION_STATUS_UNRESOLVED`.

## Canonical staging master v2

- UGC: 182
- DGME: 118
- BTEB: 504
- NU: 2294
- BNMC: 550
- **Total: 3648**

Cross-authority fuzzy deduplication is still intentionally deferred because authority-specific IDs do not provide a reliable universal entity key.

## Next data phase

Programs/subjects, current admission circulars, eligibility/GPA/group rules, fees/deadlines/seats, and scholarships should be staged with source URL, publisher, source date, retrieval date and review status before promotion to VERIFIED.
