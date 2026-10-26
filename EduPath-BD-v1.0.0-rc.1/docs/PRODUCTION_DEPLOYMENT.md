# Production deployment

This repository is a production release candidate. It deliberately refuses to start in production when required database, authentication, origin or storage settings are missing.

## Required infrastructure

- A public HTTPS domain and reverse proxy/load balancer
- PostgreSQL 17 with automated encrypted backups
- Firebase project for verified identity and phone authentication
- Supabase Storage project and private service-role secret
- Optional Gemini API key for live generative guidance
- A secrets manager or protected deployment environment

## Prepare secrets

Copy `.env.production.example` outside the repository and replace every placeholder. Generate secrets instead of inventing memorable values:

```bash
openssl rand -base64 48
```

`WEB_ORIGINS` must list the exact HTTPS frontend origins. Never put `SUPABASE_SERVICE_ROLE_KEY`, Firebase service-account JSON, database passwords or `JWT_SECRET` in frontend variables or source control.

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

Seed data is never applied automatically. To intentionally load the bundled starter catalog into an empty database, run once:

```bash
docker compose --profile seed run --rm seed
```

Place the API behind HTTPS and proxy `/api`, `/graphql`, and `/socket.io` from the frontend origin. The browser build uses same-origin requests by default. Native builds must receive the public HTTPS API URL through `scripts/build-android.mjs`.

## Release operations

- Monitor `/api/health` for process liveness and `/api/ready` for database readiness.
- Forward JSON logs to the hosting provider; use `requestId` to trace one request.
- Test database restore procedures before launch and regularly afterward.
- Apply migrations before each application rollout; do not run development migrations in production.
- Rotate secrets after accidental exposure and periodically according to the hosting policy.
- Keep at least one previous container image and database backup for rollback.

## Production boundary

Code checks cannot prove external accounts, real institution data, hosted CI, app-store signing, backups or a public domain. Complete `PRODUCTION_READINESS.md` with evidence from the actual deployment before calling the service live.
