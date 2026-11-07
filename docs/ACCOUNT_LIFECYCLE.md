# Account lifecycle and stable production identity

## Firebase identity linkage

- `User.firebaseUid` is nullable and unique so an existing database can migrate without a destructive backfill.
- Registration stores the Firebase UID immediately.
- Session synchronization matches UID or email, backfills an older account and refuses to overwrite an account already linked to another Firebase UID.

## Self-service student deletion

`DELETE /api/me/account` is authenticated, student-only and rate limited. It requires:

1. the signed-in username typed exactly;
2. in production, a freshly verified Firebase ID token;
3. a UID or email match with the linked EduPath account; and
4. a Firebase authentication time no older than ten minutes.

The server deletes the Firebase identity before deleting the PostgreSQL user. Existing relational cascades remove student-owned application data. Admin and moderator deletion remains an operator-controlled workflow.

Demo mode deletes the disposable student's profile, shortlist, applications, interactions, reports, comments, votes and ratings so the contract is testable without cloud credentials.

After success, the client clears Firebase state, the EduPath session, profile and selection state, public API cache, browser reminder timers and native deadline notifications.

## Acceptance evidence

API verification covers incorrect confirmation, successful disposable-account deletion and username release. Release verification checks the migration, stable Firebase link, recent-authentication requirement, device cleanup and responsive Account & privacy entry points. Real Firebase deletion must still be re-tested against the deployment project before launch.
