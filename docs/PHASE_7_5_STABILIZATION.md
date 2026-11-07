# Phase 7.5 — data-integrity and release stabilization

Phase 7.5 closes defects found by the downloadable browser QA evidence and the full-source audit. It strengthens existing assessed features; it does not pretend that external-service evidence or unfinished teacher requirements are complete.

## Changes

- Empty institution discussions now return `200` with `null`, so a valid empty state is not recorded as an application failure.
- Uploads normalize browser MIME aliases, reject empty/unsupported files in the UI, validate base64 and verify PDF/image/audio signatures on the API before storage.
- Firebase registration now reserves the selected username in the application store before verification email is sent. A unique constraint is the final concurrency guard, and a failed reservation removes the newly created Firebase account.
- Returning verified users keep the originally reserved username and no longer need to reconstruct it from their email address.
- A committed PostgreSQL initial migration can reproduce the complete Prisma schema.
- The API container now generates Prisma, deploys migrations, runs the idempotent seed, then starts the server. Docker Compose supplies the required local configuration and health checks.
- GitHub Actions now runs the same full `npm run qa` gate used locally.

## Evidence

- Unit tests cover username reservation/verification, collision rejection, valid upload and spoofed upload rejection.
- API verification covers the expected empty-discussion response and content-signature rejection.
- `scripts/verify-release.mjs` guards the migration, container startup, CI gate and registration/upload source wiring.
- Local acceptance on 2026-09-12: `npm run qa` passed all type checks, 11 unit tests, 49 API workflow checks, release/migration verification and the Vite production build.

## Honest boundary

The local environment used for this patch has no Docker engine, Firebase project, Supabase bucket or GitHub runner connection. Therefore container runtime, production Firebase/Supabase flows and a green remote Actions run still require their separate acceptance evidence. Phone OTP, explicit TensorFlow.js/TFLite integration, final Crystal `.rpt`, iOS/Xcode build proof and later teacher additions remain open as documented in `PHASE_7_1_AUDIT.md`.
