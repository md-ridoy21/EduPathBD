# EduPath BD v1.1.0-rc.1

## Nationwide verified-catalog foundation

This release replaces broad demo matching with a provenance-aware foundation for Bangladesh education discovery.

### Added

- Canonical 8-division and 64-district location vocabulary in English and Bangla.
- Imported upazila support with district-parent validation.
- Official data-source registry and auditable import runs with SHA-256 file hashes.
- Strict CSV import commands for upazilas, institutions and programs; dry-run is the default.
- SSC-after local discovery: exact upazila when selected, otherwise selected district only.
- HSC and diploma nationwide discovery with structured group, GPA and subject-rule evaluation.
- Higher-study pathway and expanded scholarship stages through postgraduate.
- Transparent recommendation status, score reasons, source confidence and official links.
- Context-aware AI source selection that respects stage, pathway and local scope.
- Catalog coverage endpoint and integrity gates for location and provenance quality.
- Persistent graduation CGPA, home district/upazila, preferred scope, pathways and subject results.

### Production data policy

The application never treats scraped, guessed or undated records as verified. The bundled production-safe seed provides the canonical location vocabulary, source registry and a small verified baseline. Nationwide upazila, institution and program coverage must be loaded from dated regulator exports by following `docs/NATIONWIDE_DATA_RUNBOOK.md`.

The UI reports a data gap when no verified local record exists; it does not silently substitute an unrelated institution.

### Deployment order

1. Back up and verify the current production database.
2. Run `npm run db:migrate:deploy`.
3. Run `npm run db:seed` to upsert canonical locations and source registries.
4. Validate official CSV files with `npm run data:import:official -- ...` without `--commit`.
5. Re-run with `--commit` only after the dry-run report is clean.
6. Run `npm run db:integrity -- --strict` and review `/api/catalog/coverage`.
7. Run the standard QA, E2E and live runtime checks before promotion.

### Honest release boundary

Code and validation for nationwide coverage are included. This release does not claim that every Bangladesh upazila and institution is already populated. That claim becomes valid only after the dated official datasets are imported and the coverage report passes the project’s launch thresholds.
