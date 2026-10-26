# EduPath Institution Master Reconciliation - 2026-09-23

## Result

A canonical **staging** institution master has been produced from the corrected official-data bundle. It is not yet safe for blind production import.

## BNMC

- PDF structurally parsed: **552 institution/program rows**.
- Exact unique extracted institution-name strings: **550**.
- Parsed groups: {"government_nursing": 73, "autonomous_military_nursing": 8, "private_nursing": 384, "specialty_nursing": 7, "junior_midwifery_closed": 13, "family_welfare_visitor_training": 12, "community_paramedic": 55}.
- The PDF uses embedded Bangla fonts whose text extraction is encoding-corrupted. Row/table structure and numeric cells are extractable, but institution names must be normalized/verified against the rendered PDF or another official machine-readable source before production promotion.
- Therefore BNMC records are included in the canonical staging master only with `NOT_ELIGIBLE_UNTIL_NAME_NORMALIZATION`.

## BTEB

- Source rows: **509**; unique codes: **501**; duplicate-code groups: **8**.
- Deterministic same-entity merges: 30043, 50734, 50801, 57345.
- Unresolved code collisions retained as separate staging records: 42180, 50598, 50888.
- Code 72003: coherent Rangamati TTC row retained; internally contradictory `Confuse`/Kurigram row quarantined, not deleted from evidence.
- Reconciled candidate rows: **504**; quarantined rows: **1**.
- Source-reported count 511 vs collected 509 remains unresolved, so all BTEB candidates remain staging-only.

## National University

- Live rows: **2294**; unique codes: **2294**; unique names: **2249**; duplicate-name groups: **25**.
- Static/official profile count reference: **2257**; difference: **+37**.
- No evidence in the captured CSV identifies an exact set of 37 invalid/inactive rows. Forcing deletion of 37 rows would fabricate a reconciliation.
- All 2294 live rows are therefore retained in staging with promotion blocked until authoritative status/type/currentness evidence explains the count difference.

## Canonical staging master

- Total rows: **3648**.
- UGC and DGME are included with their dated source status.
- BTEB and NU are staging-only pending reconciliation.
- BNMC is staging-only pending name normalization.
- Cross-authority deduplication is intentionally not attempted yet; merging UGC/DGME/NU/BTEB/BNMC entities by fuzzy names could create false matches.

## Next data step

1. Normalize/verify BNMC names from the 22-page rendered PDF or a current official machine-readable list.
2. Re-fetch/reconcile BTEB until reported total and captured rows agree, and obtain authoritative correction for the three unresolved code collisions.
3. Obtain NU status/type/currentness evidence (or an updated official profile count) before promoting all 2294.
4. Only then create the production import set (`VERIFIED`) from this staging master.
