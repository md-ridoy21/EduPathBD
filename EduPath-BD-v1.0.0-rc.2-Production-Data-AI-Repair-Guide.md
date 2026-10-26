# EduPath BD rc.2 — Production Data and AI Repair

## What this repair changes

- Uses `gemini-3.5-flash-lite` as the supported default model while preserving `GEMINI_MODEL` override support.
- Logs Gemini fallback events without logging prompts, responses, API keys, or credentials.
- Returns each program's official source URL in AI evidence.
- Reads SSC-based GPA rules for diploma programs instead of incorrectly reporting GPA `0`.
- Balances comparison evidence so engineering-versus-diploma questions include both pathways.
- Stops normal production seeding from inserting demo admission rules, tuition ranges, circulars, scholarships, users, or community fixtures.
- Adds an explicit `db:seed:repair` command for removing legacy demo records after a verified backup.
- Adds regression tests for the AI and seed safety contracts.

No `.env`, Firebase Admin JSON, database password, Supabase secret, Gemini key, private key, or certificate is included.

## Apply the patch

Place the patch in `~/Downloads`, then run:

```bash
cd ~/Downloads/EduPath-BD-v1.0.0-rc.2

patch --dry-run -p1 < \
  ~/Downloads/EduPath-BD-v1.0.0-rc.2-Production-Data-AI-Repair.patch

patch -p1 < \
  ~/Downloads/EduPath-BD-v1.0.0-rc.2-Production-Data-AI-Repair.patch
```

If the dry run reports that patches are already applied, do not apply them a second time.

## Verify source and build

```bash
cd ~/Downloads/EduPath-BD-v1.0.0-rc.2

npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The local E2E suite uses isolated demo services and does not write to the production Supabase database.

## Repair legacy production demo data

This step intentionally deletes fixed seed-owned demo data. Take and verify a database backup first. The repair removes:

- four demo circular IDs;
- five demo scholarship IDs;
- saved-item rows pointing to those demo IDs;
- the seeded `2026-27` admission rules for the 17 seed-owned programs;
- demo tuition ranges on those seed-owned programs.

It does not delete Firebase identities, EduPath users, profiles, real admin-created circulars with different IDs, applications, comments, ratings, media, or AI audit history.

After the backup is verified and your production environment variables are loaded:

```bash
cd ~/Downloads/EduPath-BD-v1.0.0-rc.2

npm run db:seed:repair
SUPABASE_STORAGE_BUCKET=edupath-media npm run db:integrity
```

Normal `npm run db:seed` is now non-destructive and will not insert time-sensitive demo content. Use `npm run db:seed:demo` only for an isolated local/demo database.

## Restart and smoke-test production mode

Keep your existing secret values in local environment files or your deployment secret manager. Confirm that the API environment includes:

```text
GEMINI_MODEL=gemini-3.5-flash-lite
```

Restart the API, then run:

```bash
curl -s http://127.0.0.1:4000/api/health | python3 -m json.tool
curl -s http://127.0.0.1:4000/api/ready | python3 -m json.tool
```

Expected: both endpoints succeed, `demoMode` is `false`, and configured database, Firebase, phone OTP, and Supabase Storage integrations report `true`.

Finally sign in and ask:

```text
Engineering ও diploma pathway-এর পার্থক্য কী?
```

Expected: `mode` is `gemini`; sources include both engineering and diploma/polytechnic records; each program source contains a non-empty official URL; no invented deadline or fee is presented after legacy demo cleanup.

## Validation completed on the repair

- API TypeScript typecheck: passed.
- API unit tests: 25 passed.
- Production/AI/seed contract tests: passed.
- Web TypeScript source check: passed.
- Full API + web production build: passed; Vite transformed 4,103 modules.
- Secret-pattern scan of repaired source: passed.
- Patch dry-run against the uploaded rc.2 context: passed.
- Playwright test definitions and servers started, but this workspace had no Chromium executable. Run the listed `npx playwright install chromium` and `npm run test:e2e` commands on the project machine for the final browser gate.
