# EduPath BD RC2 final source audit — 2026-09-18

## Verdict

The cumulative `v1.0.0-rc.2` source passes the repository's complete source-level QA, production-hardening, runtime-security and build gates after the final E2E isolation correction. The earlier authentication-overlay failure is corrected at the component, application-state and regression-test layers.

This is a production-ready release-candidate source, not proof that a public production deployment already exists. Live infrastructure and operational evidence listed below remain mandatory before public launch.

## Final corrective work

- Authentication state closes before session state is committed.
- Authenticated state also clears stale authentication-modal state.
- `AuthModal` immediately returns `null` when closed; a pointer-blocking exit-presence overlay cannot remain in the DOM.
- Account & privacy has a stable purpose-based accessible name.
- Playwright uses isolated API/web ports `4180` and `5178`.
- Playwright explicitly enables demo mode, disables existing-server reuse and enables strict-port failure.
- Browser API assertions use the same-origin preview proxy instead of a hard-coded cross-origin API URL.
- Operations and release checks prevent these behaviors from regressing.

## Verification completed in this audit

| Gate | Result |
| --- | --- |
| TypeScript API and web typecheck | Pass |
| API/unit tests | 20/20 pass |
| Operations/contract tests | 11/11 pass |
| TensorFlow.js model artifact and inference verification | Pass |
| API feature/authorization/workflow verification | Pass |
| Release structure and requirements 1–24 traceability | Pass |
| Production hardening verification | Pass |
| Runtime dependency-scope verification | Pass |
| Production web/API build | Pass |
| Playwright desktop/mobile test discovery | 4/4 discovered |
| Playwright browser execution in this audit container | Environment blocked: Chromium binary is not installed |

The browser-execution limitation occurred before any test scenario ran. It is not an application assertion failure. Run the laptop commands below to produce the final 4/4 browser evidence.

## Feature groups verified by automated contracts

- Responsive bilingual application shell, navigation, accessibility contracts and device diagnostics.
- Firebase-aware registration/sign-in, demo access, username reservation, session handling, sign-out, profile sync, privacy export and protected permanent deletion.
- Institution/program/circular catalog, filters, pagination, official sources, eligibility rules and trained on-device pathway-fit model.
- Institution comparison, shortlist, application tracker, checklist/status workflow, reminders and parent progress PDF/share.
- Scholarship matching for HSC and SSC technical profiles.
- Source-aware AI guidance and official-record circular summaries with key-free fallback behavior.
- Institution discussion, nested replies, votes, ratings, reports, real-time channel and moderation workflow.
- Leaflet/device map, optional Google provider, reviewed institution/global video and localized audio fallback.
- Protected admin analytics, review/publish workflow, content editing, media verification and bulk CSV import.
- PostgreSQL migrations, readiness, graceful shutdown, Docker least privilege, migration stage, backup/restore/integrity tooling and audit scope.
- PWA assets, Android/iOS Capacitor projects, notifications, Android safe areas and Crystal Reports-compatible exports/viewer source.

## Laptop final evidence commands

From a clean extraction of the cumulative archive:

```bash
npm ci
npx playwright install chromium
npm run qa
npm run test:e2e
npm run audit:runtime:high
npm run audit:tooling:critical
```

Expected Playwright result: four tests pass (two desktop Chromium and two mobile Chromium). Do not start a separate dev server for this run; the suite owns its isolated servers.

## Public-production evidence still required

- Real PostgreSQL migration and readiness evidence.
- Real Firebase identity and configured phone/email flows.
- Real Supabase bucket and upload/read policy evidence.
- Optional live Gemini key/model verification if Gemini mode will be presented.
- Official, reviewed, full-scale Bangladesh institution/program/circular/scholarship content.
- Public HTTPS domain, reverse proxy, monitoring, logs, alerting and rate-limit observations.
- Encrypted off-site backup plus a dated restore drill.
- Hosted CI release-gate evidence.
- Signed Android AAB/APK and physical-phone acceptance; iOS signing requires macOS/Xcode.
- Privacy/legal review and the proprietary Windows Crystal Reports `.rpt` layout if required by the course.

Until these items have dated evidence, describe the project as a production-ready release candidate, not a completed public-production service.
