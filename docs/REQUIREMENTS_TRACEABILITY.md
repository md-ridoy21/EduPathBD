# Course Requirements Traceability

This matrix is the source of truth for preventing any teacher requirement from being omitted.

| # | Required feature | EduPath BD implementation | Status |
|---:|---|---|---|
| 1 | Scalable PDF ERD | Four-page vector A3 PDF generated from the Prisma design with entity keys, domain map and complete relationship matrix | Phase 5 complete |
| 2 | Real-time comments from own database | PostgreSQL/in-memory repository comments and nested replies; authenticated REST writes with SSE/Socket broadcasts | Implemented; PostgreSQL two-client proof pending |
| 3 | Like/dislike with live count | One database vote per user/comment; server-calculated totals broadcast live | Implemented; PostgreSQL two-client proof pending |
| 4 | Real-time unique username check | 450ms debounced database check plus registration-time reservation, database unique constraint and collision rollback | Implemented and unit-tested; production DB/Firebase proof pending |
| 5 | Email and phone verification | Firebase email verification plus genuine Firebase Phone Auth OTP; verified email/phone identity synchronizes to PostgreSQL and fictional-number test mode avoids SMS cost | Implemented; external Firebase fictional-number proof pending |
| 6 | Multiple textboxes/dropdowns | Student profile, eligibility, catalog filters and protected institution/program/circular admin forms | Phase 3 complete |
| 7 | Real-time rating | One 1–5 institution rating per account with live average, total and distribution | Implemented; PostgreSQL two-client proof pending |
| 8 | Pagination | Server-side page pagination with total/page metadata and mobile previous/next controls | Institution/program/circular flow complete |
| 9 | External audio/video | Privacy-enhanced YouTube iframe plus external/uploaded HTML audio playback | Phase 4 complete |
| 10 | Maps/location | Interactive Leaflet/React-Leaflet campus map, OpenStreetMap tiles, campus selection and nearest-listed-campus geolocation; optional Google Maps Embed adapter | Implemented and key-free by default |
| 11 | Session/JWT | Firebase ID token verification followed by short-lived app JWT; student/moderator/admin backend authorization | Phase 2 complete |
| 12 | On-device prediction | Trained TensorFlow.js dense model with committed weights runs entirely in the device WebView; verified database admission rules remain authoritative | Implemented, trained and model-verified |
| 13 | Cloud file upload/display | Authenticated PDF/image/audio size, base64 and binary-signature validation with Supabase Storage adapter and demo preview fallback | Implemented and API-tested; live Supabase proof pending |
| 14 | Datepicker | React Datepicker powers student deadline ranges and admin start/deadline/exam fields with ordering validation | Implemented |
| 15 | GSAP/Framer Motion | Framer Motion page, card and results transitions | Foundation complete |
| 16 | SASS/Tailwind | Tailwind CSS responsive design system | Foundation complete |
| 17 | Git/Vite workflow | Git repository, npm workspaces, Vite and a single local/CI full-QA command | Local complete; GitHub delivery pending |
| 18 | GraphQL/modern API | Apollo GraphQL institution query | Complete and API-verified |
| 19 | REST/SOAP | Express REST APIs for health, auth, eligibility and protected admin operations; upload/AI routes follow in later phases | Phase 2 foundation verified |
| 20 | Crystal Report | Protected JSON/CSV, ADO.NET XSD, sample dataset, PostgreSQL views and a C# WinForms Crystal viewer source for the free SAP Visual Studio designer | Integration implemented; final proprietary Windows `.rpt` layout pending |
| 21 | Modern frontend | React + TypeScript + Capacitor shared Android/iOS/PWA codebase with committed Android and iOS native projects | Android proven; iOS signing still needs macOS/Xcode |
| 22 | Docker/CI/CD | Committed PostgreSQL migrations, separate migration job, unprivileged read-only API container, Compose readiness checks and GitHub Actions full-QA pipeline | Source implemented; Docker runtime and GitHub green-run evidence pending |
| 23 | Generative AI | Authenticated Gemini-powered source-aware guidance and circular summaries with stored audit trail and key-free failure fallback | Implemented; live free-key Gemini proof pending |
| 24 | Additional features | Bangla/English, offline catalog, accessibility, shortlist/comparison, reminders, application/document tracking, scholarship matching, parent PDF report, CSV bulk import, admin editing/moderation/analytics and modular extensions | Professional extras implemented; open for later teacher additions |

## Completion rule

A requirement can be marked complete only after its implementation, automated or repeatable test, and presentation evidence are all available.

The current honest status and exact exit checks are maintained in `docs/PHASE_7_1_AUDIT.md`.

## Phase 2 evidence

- Firebase email registration, verification, sign-in and server-side Firebase token verification
- Live username availability feedback against the same application data layer used by registration
- Signed HS256 app sessions with issuer/audience validation and student/moderator/admin role guards
- Demo student/admin accounts for offline classroom presentation without external keys
- Admin dashboard statistics and protected institution draft creation
- Automated JWT tests and end-to-end API permission checks via `npm run verify:api`

## Phase 3 evidence

- Institution and program discovery with search, category/group filters and server pagination
- Local persistent three-way comparison and account-backed institution shortlist
- Circular deadline date-range filtering and source-aware deadline cards
- Account-backed application status tracker and document checklist
- Protected admin program and circular creation workflows
- Repeatable PostgreSQL seed command for the complete sample catalog
- Seventeen end-to-end API permission and workflow checks

## Phase 4 evidence

- Two live channels: discussion events and institution rating events
- Own-database comment/reply and unique vote/rating persistence paths
- Twenty-four repeatable end-to-end API checks including SSE, comments, replies, votes, ratings and media upload
- External video/audio players and OpenStreetMap campus viewer
- Validated Supabase upload adapter with uploaded resource preview
- Persistent deadline reminders with service-worker notification and in-app fallback

## Phase 5 evidence

- Source-aware AI and circular summary APIs store model, response and exact source IDs
- Key-free demo response and automatic production failure fallback use the same API contract
- On-device pathway prediction is deterministic, versioned, explainable and offline
- Comment reports flow into a role-protected moderation queue with status transitions
- Admin analytics aggregate applications, ratings, reports, comments and AI usage
- Protected JSON/CSV reporting endpoints plus Crystal-compatible XSD and PostgreSQL views
- `output/pdf/EduPath-BD-ERD.pdf` is a four-page vector A3 architecture artifact

## Phase 6 evidence

- Persistent Bangla/English UI preference, responsive navigation, accessible focus/skip states and reduced-motion support
- Installable PWA shell with safe public-catalog caching; authenticated/private responses are never cached
- Global error boundary, loading state, connectivity banner and expired-session handling
- Explicit browser/Capacitor CORS allow-list, per-user/IP rate limits and hardened Android release manifest
- Release verifier checks versions, platform policies, native origins and all 24 traceability rows
- Physical-device checklist, final evidence guide and timed presentation/demo script

## Phase 7 evidence

- Android Doctor validates Java 21, SDK 36, platform-tools, Capacitor native project and phone authorization
- Safe build automation prevents the physical-phone `localhost` mistake, creates a versioned APK/hash and can install through ADB
- Bilingual in-app diagnostics expose runtime, API reachability/version, network, storage, notification, PWA and viewport state
- Eighteen-row physical-device acceptance sheet and resolved/open issue log keep presentation claims auditable
