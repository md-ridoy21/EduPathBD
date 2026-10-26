# Security dependency status — RC2 corrective build

The latest laptop audit reported **3 high** and **2 moderate** findings even though no critical finding was present. Therefore `audit:critical` is not sufficient for public-production sign-off.

Current findings observed on 2026-09-18:

- `deepmerge-ts < 8.0.0` through Prisma CLI/config tooling — High. The vulnerable code path is configuration/build/migration tooling rather than an EduPath HTTP request path, but it remains an open dependency finding and must be resolved or explicitly risk-reviewed before public production.
- `uuid < 11.1.1` through an older `gaxios` dependency — Moderate. A patched UUID line exists, but forcing a transitive major override without compatibility verification is not accepted as a safe fix.

Do **not** run `npm audit fix --force` blindly. The current npm suggestion can change Prisma versions and may break migrations/client compatibility.

This source adds:

- `npm run audit:high` — fails on high-or-critical production audit findings.
- `npm run release:gate` — runs core QA, Playwright browser acceptance, then the high-severity audit.

Public-production sign-off requires the release gate plus external runtime evidence (real PostgreSQL/Firebase/Supabase/HTTPS, backup restore, signed Android build and physical-device acceptance).
