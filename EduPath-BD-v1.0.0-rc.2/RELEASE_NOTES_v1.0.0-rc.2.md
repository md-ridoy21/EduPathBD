# EduPath BD v1.0.0-rc.2

## Added

- Persistent authenticated student profile read/write with visible cloud-sync state.
- Account & privacy center with personal JSON export and EduPath-only public-cache clearing.
- Stable unique Firebase UID linkage and safe migration for existing accounts.
- Student self-service deletion with typed confirmation, matching Firebase identity and recent authentication in production.
- Firebase sign-out and complete local profile, selection, cache and reminder cleanup.
- Audited production-only first-admin bootstrap command.
- Live PostgreSQL, Firebase Admin and Supabase Storage integration verifier.
- Deployed HTTPS liveness, readiness, version, CORS and catalog runtime verifier.
- Encrypted database backup, checksum-verified restore dry run, bounded retention, integrity checks and operations tests.
- Responsive desktop/mobile Account & privacy Playwright acceptance path.
- Authenticated-state modal invariant plus deterministic overlay-exit synchronization before desktop/mobile account actions.
- Updated 15-page feature, technology and manual acceptance PDF.

- Corrected the Account & privacy dialog accessible-name contract and added a regression test so desktop/mobile acceptance can locate the real dialog by purpose.

## Hardened

- Firebase email synchronization refuses to overwrite an account linked to a different UID.
- Permanent deletion requires a Firebase authentication time no older than ten minutes.
- Admin accounts remain outside the student self-service deletion workflow to protect audit continuity.
- Current v1 strict configuration, migrations, least-privilege runtime and recovery controls were retained instead of older weaker runtime files.

## Automated evidence

- `npm run qa`: passed.
- 20 API/unit tests: passed.
- 4 database-operations tests: passed.
- TensorFlow model, API contract, release and production verification: passed.
- Production web/API build: passed.
- Playwright source is updated; run `npx playwright install chromium && npm run test:e2e` on the laptop because the review workspace could not retain the downloaded browser binary.

## External evidence still required

Real PostgreSQL/Firebase/Supabase/Gemini credentials, official full-scale catalog content, public HTTPS deployment, hosted CI, signed Android AAB, iOS/macOS signing, physical-device acceptance, scheduled off-site backups/restore drill, privacy/legal approval and the final Windows Crystal Reports `.rpt` layout.

- Authentication overlay now unmounts deterministically after successful sign-in; release and operations gates enforce this lifecycle invariant.
- Local Playwright acceptance now owns dedicated strict ports (`4180`/`5178`), forces demo mode, never reuses stale development services, and checks APIs through the same-origin preview proxy.

## Runtime dependency-scope correction (2026-09-18)

- Release gate now audits the dependency surface actually shipped in the persistent API runtime (`--omit=dev --omit=optional`) at High severity.
- Persistent API image prunes development and optional dependency branches; Prisma migration tooling stays isolated to the transient migrator image.
- Full tooling tree retains a Critical-severity fail gate and a complete audit report remains available for review.
- Added automated checks preventing Prisma CLI or unused Firebase Admin Firestore/Storage optional branches from becoming runtime dependencies unnoticed.
