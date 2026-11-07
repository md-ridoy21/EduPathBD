# Implementation Roadmap

## Phase 1 - Foundation

- Monorepo, Vite, Tailwind and Framer Motion
- Cross-platform Capacitor configuration and Android native project
- PostgreSQL/Prisma domain model
- Express REST, Apollo GraphQL and Socket.IO foundations
- Interactive dashboard and eligibility prototype
- Docker and CI configuration

## Phase 2 - Identity and core data

- [x] Firebase email registration, verification and verified server session exchange
- [x] JWT middleware and student/moderator/admin roles
- [x] PostgreSQL repository with key-free in-memory demo adapter
- [x] Real-time username lookup against the application database
- [x] Admin statistics and protected institution draft creation
- [ ] Full program, rule and circular CRUD (continues with the admission workflow)
- [ ] Phone OTP (optional extension; email verification already fulfills the course verification requirement)

## Phase 3 - Admission workflow

- [x] Verified eligibility engine backed by admission-rule structures
- [x] Institution/program search, filters, pagination and comparison
- [x] Account-backed shortlist and application tracker
- [x] Deadline date filtering and document checklist
- [x] Admin program and circular creation
- [x] Repeatable PostgreSQL seed catalog
- [x] File upload to Supabase Storage (Phase 4 integration)
- [x] PWA deadline notifications with in-app fallback (Phase 4 integration)

## Phase 4 - Community, media and maps

- [x] PostgreSQL-backed real-time discussions and replies
- [x] Live like/dislike counts and institution ratings
- [x] Moderator/admin verified-answer indicators
- [x] YouTube and external/uploaded audio playback
- [x] OpenStreetMap campus views without paid keys
- [x] Validated Supabase Storage upload adapter and demo preview
- [x] Persistent PWA deadline reminders with in-app fallback
- [x] User reports and advanced moderation queue (Phase 5 admin/reporting work)

## Phase 5 - Intelligence and reports

- [x] Equivalent on-device pathway-fit model with explainable local inference
- [x] Gemini guidance with source-aware prompts and safe fallback responses
- [x] AI circular summarization and interaction audit trail
- [x] User reporting and role-protected moderation workflow
- [x] Admin analytics and protected JSON/CSV report exports
- [x] Crystal Reports XSD, sample data and PostgreSQL view package
- [x] Scalable four-page vector PDF ERD
- [ ] Save the final visual `.rpt` layout from the free Windows Visual Studio designer

## Phase 6 - Release readiness

- [x] Bangla/English localization and persistent language/profile preferences
- [x] Offline PWA shell and safe cached public catalog data
- [x] Accessibility, error, loading, connectivity and session-expiry states
- [x] API rate limits, strict native/browser origin allow-list and Android release hardening
- [x] PWA manifest/service worker and iOS-ready Capacitor project
- [x] Full requirement evidence checklist, demo data and presentation script
- [ ] Run the physical-device acceptance checklist on the student's Android phone
- [ ] Generate a signed Android App Bundle after an HTTPS production API is selected

## Phase 7 - Android device validation

- [x] Android environment doctor for Java 21, SDK 36, ADB and phone authorization
- [x] One-command LAN/HTTPS-aware debug APK build and optional install workflow
- [x] Bilingual in-app device/API readiness diagnostics
- [x] Versioned APK output path and SHA-256 generation
- [x] Physical-phone acceptance test and transparent bug log
- [ ] Execute all acceptance rows on the student's connected Android phone
- [ ] Produce the APK on a workstation with Java 21 and Android SDK 36
