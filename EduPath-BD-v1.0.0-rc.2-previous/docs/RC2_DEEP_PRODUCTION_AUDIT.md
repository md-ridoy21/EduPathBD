# EduPath BD v1.0.0-rc.2 deep production audit

## Confirmed defect and resolution

The Account & privacy modal used `aria-labelledby="account-center-title"`, but that target contained the signed-in user display name. The visible bilingual `Account & privacy` text was not the accessible name. Playwright therefore clicked the correct account button but could not find a dialog named `Account & privacy`.

Resolution: the visible bilingual purpose label now has `id="account-center-label"`; the dialog references that id; the user name has its own content id; and an operations regression test protects both the account dialog contract and critical modal `aria-labelledby` targets.

## Code-level production gates in this archive

- Strict non-demo production configuration and secret validation.
- PostgreSQL migrations, readiness, integrity, encrypted backup/restore workflow.
- Firebase identity linkage, email/phone flows, JWT authorization and account deletion safeguards.
- Supabase upload adapter and validated media lifecycle.
- Gemini source-aware guidance with labelled fallback behavior.
- Real-time comments/replies/votes/ratings over own data store with SSE/Socket channels.
- Server pagination, date validation, source verification workflow, admin moderation/audit trail.
- TensorFlow.js on-device pathway model and deterministic verifier.
- Android/iOS/Capacitor projects, native reminders, PWA/offline shell, bilingual UI.
- Protected reporting exports and Crystal Reports integration scaffold.
- Playwright desktop/mobile acceptance, source-level release checks and operations tests.

## External evidence still required before claiming public production

A source archive cannot prove external runtime systems by itself. Final public-production sign-off still requires dated evidence for real PostgreSQL, Firebase, Supabase Storage, optional Gemini, HTTPS domain/TLS, hosted CI, signed Android AAB on a physical phone, backup restore drill, monitoring, privacy/legal approval and the proprietary Crystal `.rpt` artifact. These gates are already tracked in `docs/PRODUCTION_READINESS.md` and `docs/PHASE_7_1_AUDIT.md`.

No release should be described as universally perfect or generally available until those external gates pass.
