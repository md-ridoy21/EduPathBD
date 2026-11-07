# Phase 2 - Identity and Core Data

## Delivered

- Firebase email registration, verification and sign-in UI
- Server-side Firebase ID token verification
- Two-hour application JWT with issuer, audience and HS256 validation
- Student, moderator and admin authorization middleware
- 450ms debounced username availability check
- Prisma/PostgreSQL production repository and in-memory demo repository
- Persistent browser session with explicit sign-out
- Protected admin dashboard statistics
- Protected institution draft creation with verification-first workflow
- Student and admin demo access without external credentials

## Reliable classroom demo

1. Keep `DEMO_MODE=true` in the API environment.
2. Run `npm run dev` from the repository root.
3. Select **Sign in** in the header.
4. Select **Student demo** to test the student session.
5. Sign out, select **Admin demo**, then open **Admin dashboard**.
6. Create an institution draft and verify that the dashboard count increases.

The admin demo username is `admin_demo`. Demo login is unavailable whenever `DEMO_MODE=false`.

## Production-style setup

1. Create free Firebase and Supabase projects.
2. Enable Firebase Email/Password authentication.
3. Copy `apps/api/.env.example` and `apps/web/.env.example` to local `.env` files.
4. Add the Firebase web configuration to the web environment.
5. Add the Firebase project/service-account values and PostgreSQL URL to the API environment.
6. Set a random JWT secret of at least 32 characters and set `DEMO_MODE=false`.
7. Run `npm run db:migrate -- --name identity_core`.

Never commit `.env` files or Firebase service-account JSON.

## Repeatable verification

```bash
npm run typecheck
npm test
npm run verify:api
npm run build
npm run cap:sync --workspace @edupath/web
```

`npm run verify:api` boots the compiled API on an isolated port and verifies username lookup, student login, admin login, role denial, admin statistics and draft creation.
