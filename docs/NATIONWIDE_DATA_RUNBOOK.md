# EduPath BD nationwide verified-data runbook

## What this release guarantees

- The database has a canonical 8-division and 64-district hierarchy.
- Upazilas, institutions and programs enter the student-facing catalog only through an explicit, auditable import.
- Every imported institution/program carries its regulator, source-record ID and source URL; each committed import run records its timestamp, file name and SHA-256 hash.
- Import is dry-run by default. `--commit` is required to write data.
- A rejected row prevents the whole file from being committed.
- SSC queries default to the selected upazila, or the selected district when no verified upazila is available.
- HSC queries default to all Bangladesh and rank by stage, pathway, group, result, interests and evidence.
- Missing admission rules are labelled `NEEDS_VERIFICATION`; the app never calls them eligible.
- AI receives only records selected by the same stage/pathway/location constraints.

This release does **not** label an unofficial web list as complete or verified. “All institutions” is achieved only after dated regulator exports have passed the import and coverage checks below.

## Registered official source families

| Source ID | Authority | Intended coverage |
|---|---|---|
| `source_banbeis` | BANBEIS | EIIN-based school and college directory |
| `source_dshe_emis` | DSHE EMIS | Secondary and higher-secondary institutions |
| `source_bteb` | BTEB | Polytechnic, technical, vocational and skills institutions/programs |
| `source_ugc` | UGC Bangladesh | Public/private universities |
| `source_dgme` | DGME | Medical and allied medical institutions |
| `source_bnmc` | BNMC | Nursing and midwifery institutions/programs |
| `source_nu` | National University | Affiliated colleges and programs |
| `source_moedu` | Ministry of Education | Scholarships and ministry notices |

Source URLs must use HTTPS and belong to the selected authority's domain. A secondary aggregator cannot create a `VERIFIED` record.

## Safe deployment order

```bash
cd ~/Downloads/EduPath-BD-v1.1.0-rc.1

npm run db:backup
npm run db:migrate:deploy
npm run db:seed
SUPABASE_STORAGE_BUCKET=edupath-media npm run db:integrity
```

`db:seed` adds/updates only the location vocabulary, source registry and the existing production-safe catalog seed. It does not create fake admission circulars, scholarships, users or applications.

## Import an official export

1. Download a dated export from the regulator and retain the original file unchanged.
2. Make a normalized CSV copy using the exact header from `data/import-templates`.
3. Preserve the regulator's stable code in `source_record_id`/`official_code`; do not invent a new code.
4. Validate first (no database writes):

```bash
npm run data:import:official -- \
  --kind upazilas \
  --file /absolute/path/to/upazilas.csv \
  --source source_banbeis
```

5. Review the JSON report, then repeat with `--commit`:

```bash
npm run data:import:official -- \
  --kind upazilas \
  --file /absolute/path/to/upazilas.csv \
  --source source_banbeis \
  --commit
```

Import order is `upazilas` → `institutions` → `programs`. Programs reference institutions through `institution_official_code`.

List fields such as `subject_areas` and `available_groups` use a pipe delimiter, for example `Computer Science|Data Science`.

## Coverage and quality gates

After every committed file:

```bash
SUPABASE_STORAGE_BUCKET=edupath-media npm run db:integrity -- --strict
curl -s http://127.0.0.1:4000/api/catalog/coverage | python3 -m json.tool
```

Do not announce nationwide completeness while any of these are true:

- fewer than 8 divisions or 64 districts;
- the expected official upazila total for the dated government export is not met;
- any district has zero verified institutions;
- local SSC-after pathways lack an upazila link;
- verified institutions/programs have no source URL or provenance;
- a program lacks a current structured admission rule but is presented as eligible.

## Updating admission rules and scholarships

Institution/program directories change more slowly than admission rules, circulars and scholarships. Treat the latter as time-bound content:

- record the exact academic session;
- save the official notice URL and effective dates;
- mark superseded records `OUTDATED` rather than overwriting their history;
- keep fees, dates and subject-grade thresholds empty when the official notice does not state them;
- never infer a deadline, ranking, seat count or eligibility threshold with AI.

## Student-facing behavior to manually verify

1. SSC + district + upazila: only that upazila is returned.
2. SSC + district without upazila: only that district is returned.
3. SSC local data gap: no unrelated district is substituted.
4. HSC: suitable verified programs are searched nationwide.
5. A failed GPA/group/subject rule is excluded.
6. Missing current rule is shown as `NEEDS_VERIFICATION`, not “eligible”.
7. AI citations contain only the same stage/pathway/location evidence.
8. Scholarship questions cite scholarship records, not unrelated programs.
