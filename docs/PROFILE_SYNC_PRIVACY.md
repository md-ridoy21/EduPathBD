# Production profile sync and account privacy

## Implemented behavior

- `GET /api/me/profile` returns only the authenticated student's pathway profile.
- `PUT /api/me/profile` validates level, group, GPA, interest and preferred location before saving.
- PostgreSQL persists production profiles; demo memory implements the same contract for repeatable QA.
- After student sign-in, the client hydrates the cloud profile and debounces later updates.
- The UI displays loading, saving, synced and error states instead of silently claiming success.
- `GET /api/me/export` produces a user-scoped JSON export of account, profile, shortlist, applications and activity. Firebase UID, passwords, credentials and server secrets are excluded.
- The Account & privacy screen clears only keys prefixed with `edupath_public_api:`; unrelated local storage is untouched.
- Signing out clears both the EduPath application session and the Firebase browser/native session.

## Acceptance evidence

`npm run verify:api` checks empty-profile behavior, persistence/reload, authorization and personal export contents. Playwright opens Account & privacy on both desktop and mobile layouts. `npm run verify:release` checks the complete route-to-UI wiring.

## Deployment boundary

The source is ready for live integration, but production evidence still requires PostgreSQL, Firebase and HTTPS deployment credentials. Do not store Firebase Admin JSON, service-role keys, JWT secrets or signing credentials in source control.
