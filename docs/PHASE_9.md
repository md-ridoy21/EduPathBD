# Phase 9 — verified media and automated acceptance

Version: 0.9.0

## Delivered

- Removed the unrelated hardcoded YouTube and pronunciation-audio placeholders.
- Added institution-specific media records with pending/verified/outdated/rejected review states.
- Added protected admin creation and editing for YouTube and direct HTTPS audio resources.
- Normalized approved YouTube links to privacy-enhanced `youtube-nocookie.com` embeds.
- Kept all unverified uploads and admin submissions hidden from students.
- Added an honest empty state and an institution-specific browser speech guide when no approved recording exists.
- Added visible progress feedback to network-backed admission, reminder, community and admin actions.
- Added desktop/mobile Playwright acceptance tests with console, page-error, first-party HTTP failure and one-second latency reporting.
- Added CI browser installation, E2E execution and retained Playwright reports.

## Verification

`npm run qa` validates types, API behavior, release evidence, trained model integrity and production builds. `npm run test:e2e` runs the browser acceptance suite after Chromium is installed.

External service keys, two-client database proof, a GitHub Actions run and the Windows Crystal Reports `.rpt` layout remain environment-specific evidence, not hidden code claims.
