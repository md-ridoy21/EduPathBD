# Phase 7.2 interaction and data-integrity audit

## Closed in this audit

- Cleared stale authentication notices and auto-dismissed transient notices.
- Increased primary mobile touch targets and protected anchored content from the native safe-area header.
- Removed unnecessary CORS preflights from bodyless API requests.
- Completed Bangla coverage for admission workflow states, media tools and comment reporting.
- Hardened upload retry and authentication behavior.
- Tracked the community rating and discussion real-time channels independently.
- Added keyboard/dialog semantics to critical overlays.
- Rejected inverted tuition ranges and impossible circular date sequences in both the UI and API.
- Added an administrator review queue with publish, reject, reopen and retire decisions.
- Prevented unverified records and verified child records under an unverified institution from appearing to students.
- Corrected verified catalog counts and cross-filtered program results by institution type and district.
- Expanded community rooms from a hardcoded pair to the verified institution catalog.
- Separated moderator permissions from administrator publishing controls.
- Refreshed student catalog totals and records immediately after an admin content decision.
- Reconciled real-time comment events with the active paginated page.

## Release blockers still requiring project decisions or external proof

| Area | Current state | Required before final academic hand-off |
|---|---|---|
| Admin record editing | Admin can create, CSV-import, edit, review, publish, reject, reopen and retire content with an audit trail | Runtime acceptance only |
| Phone verification | Genuine Firebase Phone Auth exists with a fictional-number test mode | Configure a fictional number/OTP and capture free runtime proof |
| ML framework evidence | A trained TensorFlow.js dense model and repeatable model verifier are committed | Show offline inference during acceptance |
| Crystal Reports | Protected JSON/CSV datasets are ready; no `.rpt` is bundled | Create the `.rpt` on Windows with the course-approved SAP/Visual Studio tooling |
| Live cloud integrations | Key-free demo mode is complete | Configure free-tier Firebase/Supabase/Gemini/PostgreSQL projects and capture runtime evidence |
| Repository and CI | Source is versioned locally | Publish to the student's GitHub account and confirm CI on the final source |

These are visible project risks rather than hidden claims. The release candidate should not be labelled final until each required row is completed or explicitly waived by the teacher.
