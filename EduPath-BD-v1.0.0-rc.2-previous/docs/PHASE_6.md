# Phase 6 — Release readiness

Phase 6 turns the complete assessed prototype into a safer, bilingual and presentation-ready release candidate.

## Delivered

- Persistent English/Bangla interface for the core student journey
- Installable PWA manifest, offline shell and network-first public catalog cache
- Global error boundary, loading UI, offline banner and expired-session recovery
- Keyboard skip navigation, visible focus states, ARIA labels and reduced-motion preference
- Strict browser/native origin allow-list and rate limits on auth, community, upload and AI writes
- Android version 0.6.0 with backup and production cleartext traffic disabled
- Debug-only LAN HTTP allowance for physical-phone development
- Automated release policy verifier and expanded API verification
- Android acceptance checklist, final evidence matrix and timed presentation script

## Safety boundaries

- Only public GET catalog data can enter the offline cache; authenticated/admin data is excluded.
- The production Android build requires an HTTPS API. Only debug builds allow a laptop LAN HTTP address.
- Live Gemini is enabled by a free API key on the server. Key-free demo/fallback is deterministic and visibly labelled.
- Store registration, production hosting and iOS signing are deployment concerns, not required for the local academic demo.

## Verification

Run `npm run typecheck`, `npm test`, `npm run verify:api`, `npm run verify:release`, `npm run build` and the web workspace Capacitor sync command. Then complete the physical-device checklist before presentation.
