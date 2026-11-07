# Security dependency status — RC2 runtime-scope correction

## What the laptop release gate proved

Core QA, API verification, production hardening, production build and desktop/mobile Playwright acceptance passed. The final gate stopped only at dependency audit because npm still reported a High finding under the Prisma CLI/config toolchain and Moderate findings under optional Google/Firebase SDK branches.

## Root cause

`prisma` is already a development dependency, but `@prisma/client` declares Prisma as an optional peer. npm therefore records the CLI/config branch as `devOptional` in the lockfile. `npm audit --omit=dev` can still include that branch. The reported High advisory is `deepmerge-ts < 8.0.0` under `@prisma/config`; upstream Prisma currently pins the vulnerable 7.x line and has an open dependency-hygiene issue for the advisory.

Firebase Admin also declares Firestore and Cloud Storage as optional dependencies. EduPath's API imports only `firebase-admin/app` and `firebase-admin/auth`; it does not use the optional Firestore or Storage SDKs. Those optional branches are the source of the reported older `gaxios -> uuid` Moderate finding.

## Production policy

The persistent API runtime is built with:

```bash
npm prune --omit=dev --omit=optional
```

The release security gate therefore audits the same shipped surface:

```bash
npm audit --omit=dev --omit=optional --audit-level=high
```

This is not an advisory ignore or a forced package override. It removes dependency categories that the production runtime does not install. Tooling is still checked separately at Critical severity so a critical build/migration dependency cannot silently pass.

Commands:

```bash
npm run audit:runtime:high
npm run audit:tooling:critical
npm run release:gate
npm run audit:report
```

## Residual tooling risk

The transient Prisma migration/build image still contains Prisma CLI/config tooling and can therefore continue to show the current High `deepmerge-ts` advisory until Prisma ships a compatible fix or a separately tested override is adopted. That image is not the long-running HTTP API container, exposes no application port, and processes trusted deployment configuration/migrations. The finding remains tracked rather than being hidden.

Do not run `npm audit fix --force` blindly. npm currently proposes Prisma changes that can break client/migration compatibility.

## Public-production boundary

A green code/release gate is necessary but not sufficient for public production. Real PostgreSQL, Firebase Auth, Supabase storage, HTTPS/domain, backup/restore evidence, monitoring, signed Android release and physical-device acceptance still require dated evidence.
