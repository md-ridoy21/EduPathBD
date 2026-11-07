# Production deployment

This repository is a production release candidate. It deliberately refuses to start in production when required database, authentication, origin or storage settings are missing.

## Required infrastructure

- A public HTTPS domain and reverse proxy/load balancer
- PostgreSQL 17 with automated encrypted backups
- Firebase project for verified identity and phone authentication
- Supabase Storage project, a private `edupath-media` bucket, and a private service-role secret
- Optional Gemini API key for live generative guidance
- A secrets manager or protected deployment environment

## Prepare secrets

Copy `.env.production.example` outside the repository and replace every placeholder. Generate secrets instead of inventing memorable values:

```bash
openssl rand -base64 48
```

`WEB_ORIGINS` must list the exact HTTPS frontend origins. Never put `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`), Firebase service-account JSON, database passwords or `JWT_SECRET` in frontend variables or source control.

## Deploy the API

Validate the release first:

```bash
npm ci
npm run qa
npm run test:e2e
npm run audit:critical
```

With the production variables loaded, Compose performs migrations once and then starts the unprivileged API container:

```bash
docker compose build
docker compose up -d postgres migrate api
curl --fail http://127.0.0.1:4000/api/ready
```

Before opening traffic, prove that the configured PostgreSQL, Firebase Admin and Supabase Storage accounts are reachable, then verify the deployed HTTPS runtime and allowed browser origin:

```bash
npm run production:integrations-check
npm run production:runtime-check -- --api-url https://api.example.com --origin https://app.example.com
```

These checks print pass/fail evidence but never print secret values.

## Bootstrap the first administrator

Create and verify the operator's email in the production Firebase project first. With production environment variables loaded, run this explicit one-time command:

```bash
npm run admin:bootstrap -- --email admin@example.com --username edupath_admin --confirm-promote-admin
```

The command is disabled unless `NODE_ENV=production` and `DEMO_MODE=false`. It links the immutable Firebase UID, refuses a conflicting link and writes an audit log. Later role changes should use a controlled operator workflow, not direct database edits.

Seed data is never applied automatically. To intentionally load the bundled starter catalog into an empty database, run once:

```bash
docker compose --profile seed run --rm seed
```

This production-safe seed excludes demo accounts, discussions, reports and ratings. `npm run db:seed:demo` exists only for an isolated classroom database and must never be run against production.

Place the API behind HTTPS and proxy `/api`, `/graphql`, and `/socket.io` from the frontend origin. The browser build uses same-origin requests by default. Native builds must receive the public HTTPS API URL through `scripts/build-android.mjs`.

## Release operations

- Monitor `/api/health` for process liveness and `/api/ready` for database readiness.
- Re-run `production:integrations-check` after credential rotation and `production:runtime-check` after every deployment.
- Forward JSON logs to the hosting provider; use `requestId` to trace one request.
- Test database restore procedures before launch and regularly afterward.
- Apply migrations before each application rollout; do not run development migrations in production.
- Rotate secrets after accidental exposure and periodically according to the hosting policy.
- Keep at least one previous container image and database backup for rollback.

## Data protection and rollback

The repository now provides encrypted backup, checksum-verified dry-run restore and application-specific integrity commands. Follow `docs/DATABASE_RECOVERY.md`. Schedule `db:backup` daily, copy each backup/manifest pair off-site, alert on missed backups, and complete a restore drill before public launch. A source-level backup feature is not production evidence until the deployed scheduler and a successful separate-database restore are recorded.

## Account and privacy operations

- Student pathway preferences sync through authenticated `/api/me/profile` endpoints.
- Personal exports are scoped to the signed-in user and exclude Firebase UID and credentials.
- Student account deletion requires typed confirmation plus a matching Firebase token authenticated within the last ten minutes.
- Admin accounts deliberately have no self-service deletion route; preserve audit continuity through an operator-controlled offboarding process.
- Re-test export and deletion against the real Firebase/PostgreSQL deployment before publishing store builds.

## Production boundary

Code checks cannot prove external accounts, real institution data, hosted CI, app-store signing, backups or a public domain. Complete `PRODUCTION_READINESS.md` with evidence from the actual deployment before calling the service live.
