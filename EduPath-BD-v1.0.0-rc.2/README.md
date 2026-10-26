# EduPath BD

EduPath BD is an AI-powered cross-platform education, admission and career decision-support application for Bangladeshi students. The shared React codebase targets Android, iOS and Web/PWA through Capacitor.

## Current milestone

- Android v1.0.0-rc.2 release tooling with environment doctor, safe API injection, APK hash and optional ADB install
- Registration-time username reservation, content-signature upload validation and clean empty-community states
- Reproducible PostgreSQL migrations with a separate production migration job, explicit opt-in seeding and full-QA GitHub Actions gate
- Persistent reminder center, corrected mobile navigation and working pathway actions
- Exact verified catalog totals instead of placeholder marketing counts
- Truthful 24-requirement completion audit with explicit external-integration exit checks
- Bilingual in-app device/API diagnostics and physical-phone acceptance test
- Bangla/English student interface with persistent preference
- Installable offline-capable PWA with public-catalog cache and network status
- Accessible skip/focus/loading/error states and reduced-motion support
- Native/browser CORS allow-list, request throttling and hardened Android release manifest
- Final requirement evidence, Android acceptance checklist and timed presentation script
- Source-aware Edu AI with key-free fallback and circular summaries
- Trained TensorFlow.js on-device pathway prediction that works offline
- Database-driven SSC/HSC admission-rule eligibility with official sources
- Scholarship matching, saved opportunities and deadline reminders
- Parent/guardian PDF progress reports with mobile sharing
- Admin CSV bulk import and audited content editing
- React Datepicker, Leaflet map/geolocation and Capacitor local notifications
- Firebase phone OTP with an explicit no-SMS fictional-number demo mode
- Committed Capacitor iOS native project alongside Android and PWA
- User report flow and admin moderation queue
- Admin application/rating/AI analytics with protected CSV/JSON exports
- Crystal Reports-compatible XSD, sample CSV and PostgreSQL views
- Four-page scalable vector PDF ERD
- Database-backed real-time comments, replies and live like/dislike totals
- Live one-per-account institution rating with distribution
- Supabase cloud media adapter with validated demo upload/preview
- Institution/global verified media with bundled video, bilingual audio fallbacks and free OpenStreetMap campus viewer
- Persistent deadline reminders with service-worker notification
- Institution/program discovery with filters and server pagination
- Persistent three-choice institution comparison
- Account shortlist, application status and document checklist
- Deadline calendar with date-range picker and sourced circulars
- Admin program/circular creation and repeatable PostgreSQL seed data
- Firebase verified-email registration and sign-in flow
- Short-lived JWT sessions with student, moderator and admin roles
- Live database-backed username availability feedback
- Protected admin control center with statistics and institution draft creation
- Key-free student/admin demo accounts for reliable classroom presentation
- Responsive product shell and student dashboard
- Interactive profile and eligibility demo
- Institution, deadline and pathway discovery screens
- REST health, username and eligibility endpoints
- GraphQL institution query foundation
- Socket.IO real-time event foundation
- Scalable PostgreSQL/Prisma data model
- Docker and GitHub Actions configuration

## Lightweight development workflow

This project is optimized for an 8 GB RAM laptop. Use a physical Android phone instead of an emulator, keep the database in Supabase for daily development, and run Docker only when validating containerization.

## Requirements

- Node.js 22 or newer
- npm 11 or newer
- Android Studio and an Android phone for Android builds
- PostgreSQL locally, or a Supabase PostgreSQL connection string
- Windows 11 with Visual Studio Community for the Crystal Reports module

## Start locally

```bash
cp .env.example .env
npm ci
npm run dev
```

`npm ci` automatically generates the Prisma Client from the API workspace schema. If an older extracted copy was installed before this safeguard was added, run `npm run db:generate` once before `npm run qa` or `npm run dev`.

Web: `http://localhost:5173`

API health: `http://localhost:4000/api/health`

GraphQL: `http://localhost:4000/graphql`

The default `DEMO_MODE=true` needs no Firebase or database keys. Choose **Student demo** or **Admin demo** from the sign-in window. For production-style authentication, configure Firebase and Supabase and set `DEMO_MODE=false`. Follow `docs/FREE_SERVICE_SETUP.md` for exact free/demo boundaries.

The AI assistant has a deterministic source-aware demo fallback without an API key. This fallback is not generative AI. To prove the course's generative-AI requirement, set a free `GEMINI_API_KEY` only in the API environment and demonstrate a response labelled `gemini`; `GEMINI_MODEL` remains configurable.

For production uploads, create a private Supabase Storage bucket named `edupath-media` (Public bucket off) and configure `SUPABASE_STORAGE_BUCKET`. Create a dedicated `sb_secret_...` key as `SUPABASE_SECRET_KEY` and keep it only on the API server; the legacy `SUPABASE_SERVICE_ROLE_KEY` remains a temporary migration fallback. The API stores internal object references and issues short-lived signed URLs to authorized requests.

For browser testing on an Android phone connected to the same Wi-Fi network, run `npm run dev:phone --workspace @edupath/web` and open the computer's LAN address on the phone.

When the Android app needs to call an API running on the laptop, set `VITE_API_URL` to the laptop's LAN URL (for example `http://192.168.0.10:4000`) before building. `localhost` inside the phone means the phone itself.

The Android debug manifest permits that LAN HTTP workflow. Production builds reject cleartext traffic, so a signed/Play Store build must use an HTTPS API. Development and direct APK testing are free; Google Play developer registration is a separate store cost.

## Verification

```bash
npm run qa
npm run test:e2e
npm run audit:critical
```

## Database

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

`db:seed` loads only the starter institution, program, circular and scholarship catalog. It skips demo accounts and community activity by default. For an isolated classroom/demo database only, `npm run db:seed:demo` explicitly adds demo users, discussion, report and rating fixtures. Never run that demo command against production.

For a production-style PostgreSQL container and API, first supply every required value from `.env.production.example`, then run `docker compose up --build postgres migrate api`. Migrations complete before the unprivileged API starts; seed data is never loaded automatically. Use `docker compose --profile seed run --rm seed` only when you intentionally want the starter catalog. See `docs/PRODUCTION_DEPLOYMENT.md`.

## Android

```bash
npm run android:doctor
npm run dev:api
npm run android:debug -- --api-url http://YOUR_LAPTOP_IP:4000 --install
```

The final command builds, syncs, creates `output/android/EduPath-BD-v1.0.0-rc.2-debug.apk` and installs it when exactly one authorized phone is connected. Use `npm run android:prepare -- --api-url ...` to prepare the native project without requiring Gradle, then open `apps/web/android` in Android Studio.

Before claiming production completion, read `docs/PHASE_7_1_AUDIT.md`. Live service credentials, the final Windows-authored Crystal `.rpt`, an iOS/Xcode build, a green GitHub Actions run and later teacher additions remain tracked exit checks.

## Architecture rules

- Verified eligibility is calculated from current database admission rules.
- A trained bundled TensorFlow.js model provides on-device pathway fit prediction, not an admission guarantee.
- Gemini explains recommendations and summarizes verified content; core app functions remain available when AI is unavailable.
- Comments, votes, ratings and username uniqueness are stored in PostgreSQL.
- Admin-managed information includes a source URL, verification status and last-updated timestamp.
