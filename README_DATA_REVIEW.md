# EduPath BD — Official Data Review (2026-09-23, post-v4 metadata revision)

This package contains official-source captures plus live-crawled datasets. The metadata in this revision was regenerated **after** the BTEB/NU/BNMC v4 collection so that `SOURCE_MANIFEST.csv` no longer describes the earlier partial snapshot.

## Current evidence

- **Bangladesh administrative master:** 499 upazila rows covering 8 divisions / 64 districts / 499 upazilas.
- **BBS geocode source index:** 64 official district-PDF links. Keep the code layer under reconciliation because these documents are older than the current National Portal hierarchy.
- **BANBEIS:** 35,673 extracted EIIN rows, but the attachment internally references `SURVEY2015`; keep it as legacy matching/reference data, not a current production master.
- **BTEB CBT&A live crawl:** 509 rows, 501 unique institute codes, 8 duplicate-code occurrences. The source report captured `reportedTotal=511`, so the live crawl is suitable for **staging/reconciliation**, not direct VERIFIED promotion.
- **UGC universities:** 182 institution rows ({'cbhe': 1, 'international': 3, 'private': 117, 'public': 61}). This is suitable for institution verification. Approved faculty/program coverage remains incomplete and is a separate phase.
- **DGME Medical/Dental:** 118 rows (38 public, 80 private), with source URL and retrieval date preserved.
- **BNMC:** the latest 14 June 2026 institution-list PDF was captured from the official page (published 2026-09-02); institution rows still need structured extraction. The NVDA screen-reader executable link is unrelated and must not be treated as BNMC data.
- **National University live crawl:** 2294 rows / 2294 unique college codes. NU's official profile count reference is 2,257, so the 2,294 live rows must be reconciled by status/type/currentness before VERIFIED promotion. Duplicate names alone are not evidence of duplicate institutions because college codes are unique.

## Production-import rule

`SOURCE_MANIFEST.csv` is authoritative for **staging policy**, not a license to bulk-promote every official row. Values marked `YES_AFTER_RECONCILIATION` may enter a staging table, but must not become `VERIFIED` until the listed reconciliation is complete. `NO_DIRECT_IMPORT`, `NO_AS_MASTER`, and `NO_AS_PROGRAM_MASTER` remain reference/pending datasets.

## What changed from the earlier package

The old manifest described the pre-crawl state (`BTEB 199 rows`, `NU 0 rows`, `BNMC attachment pending`). Those statements were stale after the later collectors succeeded. This revision updates the manifest, stats, and review notes to the actual post-v4 evidence while preserving unresolved discrepancies instead of overstating production readiness.

## Next data-finalization work

1. Parse the BNMC PDF into normalized institution rows and validate counts/fields.
2. Reconcile BTEB duplicate codes and the source-reported total vs collected rows.
3. Reconcile NU 2,294 live rows against the 2,257 official profile count using source status/type/currentness fields, not name-based deletion.
4. Build the canonical institution staging/master with provenance and review status.
5. In the next phase, collect/normalize approved programs/subjects, current admission circulars, eligibility/GPA/group rules, fees/deadlines/seats, and scholarships.
