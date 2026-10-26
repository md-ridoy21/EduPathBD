# EduPath BD v1.1.0-rc.1 — Full Safety / Publication Audit Fix

Audit basis: `EduPath-BD-v1.1.0-rc.1-Nationwide-Production-Source.zip` plus the v6.3 reviewed-data workflow.

## Fixed high-impact issues

1. **Official catalog import no longer auto-publishes content.** Normal commits produce `DRAFT`. Publishing `VERIFIED` requires both `--publish-verified` and `ALLOW_VERIFIED_CATALOG_IMPORT=YES`.
2. **Importer identity/source validation hardened.** Duplicate source IDs/slugs/codes are rejected; ambiguous institution official-code matches are rejected; HTTPS/source-domain checks are enforced; fake `sourceUpdatedAt=now()` semantics were removed.
3. **Admission rules gained an independent verification lifecycle.** `verificationStatus` defaults to `PENDING`, `verifiedAt` is tracked, and a migration is included.
4. **Public admission eligibility is verification-gated.** Program group filtering, program payloads and eligibility evaluation only use VERIFIED admission rules.
5. **Scholarships are fully reviewable.** Admin create/edit/review support was added, while public scholarship results require verified scholarship status and verified linked parents.
6. **Parent/child publication integrity added.** Programs, admission rules, circulars, scholarships and media cannot be marked VERIFIED while required parent content is unverified.
7. **Admin workflow expanded.** Admission rules and scholarships are now present in review queues and admin creation forms/API endpoints.
8. **Relation integrity checks added.** Program/institution and circular/scholarship parent relationships are validated before creation.
9. **Discussion visibility bypass closed.** Comments, comment creation, votes and reports cannot access a discussion whose institution/program/circular parent is not public/verified.
10. **Verified media parent gating strengthened.** Program-linked media now also requires a verified program/institution chain.
11. **Admin pending counts corrected.** Admission rules and scholarships are included in verification backlog counts.
12. **Scholarship JSON creation hardened.** Optional GPA is omitted rather than serializing `undefined` into Prisma JSON.
13. **Regression coverage added.** `tests/ops/content-publication-safety.test.mjs` verifies publication lifecycle and importer safety invariants.

## Validation performed in the audit environment

- TypeScript/TSX parser syntax check: **64 files, 0 parse errors**.
- Existing + new static ops test suite: **20/20 tests passed**.
- Hardcoded credential scan: **no matching real secret/private-key pattern found**.
- Production/demo configuration review: production mode already fails closed when demo mode is enabled or required secrets/database configuration are absent.

## Environment limitation

A fresh dependency installation was not available in the audit container, so a complete dependency-resolved `npm run typecheck`, application build, Playwright E2E, live PostgreSQL migration, Firebase/Supabase checks, Android build and live runtime checks were not rerun here. The user's current local project already passed API typecheck after the importer safety fix; the included apply script intentionally preserves local `.env` files and dependencies so the full project QA can be run there.

## Safe rollout order

1. Apply overlay and keep the automatically-created backup.
2. `npm run db:generate`
3. `npm run typecheck`
4. `npm run test:ops`
5. `npm run qa`
6. Back up PostgreSQL.
7. `npm run db:migrate:deploy`
8. Run `npm run db:integrity -- --strict` (with production/staging `DATABASE_URL`).
9. Dry-run official imports first. Normal `--commit` stays DRAFT.
10. Only after human/source production verification should an intentional VERIFIED import use the explicit publish gate.
