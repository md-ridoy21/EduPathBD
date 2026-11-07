# Bug and limitation log

## Automated audit result

| ID | Finding | Severity | Resolution/status |
|---|---|---|---|
| P7-001 | A physical Android build using the default API URL would treat `localhost` as the phone itself | Critical | Fixed: build script requires a LAN/HTTPS URL and in-app Device Check detects unsafe native localhost |
| P7-002 | No repeatable way to identify missing Java/SDK/ADB setup | High | Fixed: `npm run android:doctor` reports exact blockers |
| P7-003 | Presentation phone had no self-test for backend/device capabilities | Medium | Fixed: bilingual Device Check added to the footer |
| P7-004 | New Android Studio JBR 25 was accepted by the doctor although Gradle 8.14.3 supports running through Java 24; debug cleartext also lacked an explicit manifest override | High | Fixed: doctor/build select Java 21–24 and debug manifest declares `tools:replace` |
| P7-005 | Capacitor's HTTPS WebView origin blocked the LAN HTTP API as mixed content even when the debug manifest allowed cleartext | Critical | Fixed: the debug builder enables WebView mixed content only for an explicitly supplied HTTP API URL; HTTPS builds leave it disabled |
| P7-006 | Android 16 edge-to-edge status bar overlapped the header and intercepted hamburger-menu taps | High | Fixed: Capacitor SystemBars CSS insets now protect the sticky header and bottom navigation; Device Check verifies the top inset |
| P7-007 | The authenticated mobile navigation exposed dashboard access but no sign-out action | High | Fixed: one shared sign-out handler now clears the persisted session from both desktop and mobile navigation and confirms completion |
| P71-001 | Header notification bell had no action | High | Fixed: it now opens the persistent reminder center |
| P71-002 | Pathway Explore controls had no behavior | High | Fixed: each control selects its pathway, generates results and opens eligibility |
| P71-003 | Mobile Profile navigation incorrectly opened institutions | High | Fixed: mobile destinations now map to real major sections and active state follows scrolling |
| P71-004 | Hero catalog and progress cards contained invented counts | High | Fixed: verified catalog totals come from the API; fake progress was replaced with real navigation actions |
| P71-005 | A sign-out confirmation could remain visible after the user immediately signed in again | Medium | Fixed: authentication clears stale notices and transient app notices now dismiss automatically after four seconds |
| P72-001 | Several mobile controls were smaller than the recommended touch target and anchored sections could hide under the safe-area header | High | Fixed: primary interactive controls now use 44 px minimum targets and section anchors account for the native safe area |
| P72-002 | Read-only GET requests always sent a JSON content type and triggered avoidable browser CORS preflights | Medium | Fixed: JSON content type is only sent when a request body exists |
| P72-003 | Media, reporting and admission workflow states remained partly English after switching to Bangla | Medium | Fixed: student-facing media, report and workflow labels/messages now follow the saved locale |
| P72-004 | Upload opened the system file chooser before checking authentication and selecting the same file twice did not reliably trigger a retry | Medium | Fixed: sign-in is checked before opening the chooser and the file input resets after every attempt |
| P72-005 | Community live status used one shared flag for two event streams, allowing one failed stream to hide the other stream's healthy state | Medium | Fixed: rating and discussion stream health are tracked independently |
| P72-006 | Admin forms accepted inverted tuition ranges and impossible application/exam date sequences | High | Fixed: both the interface and API now reject invalid ranges; API verification covers both cases |
| P72-007 | Core dialogs did not consistently close with Escape or expose dialog semantics to assistive technology | Medium | Fixed: authentication, reminder, device-check and report dialogs now implement Escape handling and dialog metadata |
| P72-008 | Draft, rejected and outdated academic records could leak into public catalog queries, while admins had no usable review/publish queue | Critical | Fixed: public queries expose verified records only; child content also requires a verified parent; admins can review, publish, reject, reopen or retire content and database decisions create audit logs |
| P72-009 | Pending-verification statistics counted only pending institutions, not draft/rejected/outdated programs and circulars | High | Fixed: the aggregate now covers every non-verified record across all three content types |
| P72-010 | Institution type and district filters changed institution cards but left the program list unrelated | High | Fixed: program queries now apply the same type and district filters on both demo and PostgreSQL stores |
| P72-011 | Moderator dashboard exposed administrator-only creation and publishing controls that would fail with a permission error | Medium | Fixed: moderators now receive a focused analytics/moderation view while publishing controls remain admin-only |
| P72-012 | The deadline calendar opened with a fixed 2026 date range, so newly maintained sessions would be hidden by default | High | Fixed: the initial range is calculated from today through the next 120 days while remaining editable with date pickers |
| P73-001 | Testers had to identify browser failures manually from a noisy developer console | High | Fixed: a development-only QA panel captures runtime/network errors and runs API, navigation, accessibility, storage, touch-target and responsive checks with copyable/downloadable evidence |
| P73-002 | There was no single repeatable command for the complete repository quality gate | Medium | Fixed: `npm run qa` runs typecheck, unit tests, API verification, release evidence and the production build in sequence |
| P74-001 | The first browser audit reported a false health failure because it checked `/api` instead of `/api/health` | Medium | Fixed: the browser audit now verifies the canonical health endpoint |
| P74-002 | Lazy AI and community sections could be reported as broken navigation targets before their chunks mounted | Medium | Fixed: navigation checks now wait up to three seconds for lazy targets and deduplicate genuine failures |
| P75-001 | A valid institution with no discussion returned 404 and polluted browser QA with a false application failure | Medium | Fixed: the API returns a successful nullable discussion and the community UI handles it as an empty state |
| P75-002 | Browser MIME differences and content/type spoofing caused unclear upload failures or could bypass extension-only expectations | High | Fixed: UI MIME normalization plus API base64, size and binary-signature validation now return specific safe errors |
| P75-003 | Username availability was checked before Firebase creation but the name was not reserved until a later verified login | Critical | Fixed: registration reserves the name immediately; the database unique constraint handles races and failed reservations roll back the Firebase account |
| P75-004 | No committed migration could reproduce the PostgreSQL schema and the API container started without migrate/seed | Critical | Fixed in source: initial migration and migrate-seed-start container lifecycle added; runtime Docker proof still pending |
| P75-005 | GitHub Actions ran only typecheck/build, omitting unit, API and release verification | High | Fixed in workflow: CI now generates Prisma and runs the complete repository QA gate; remote green-run evidence remains pending |
| P80-001 | Eligibility UI used a client formula disconnected from current admission rules | Critical | Fixed: the API evaluates current verified `AdmissionRule` records and returns sourced program matches |
| P80-002 | The earlier “on-device model” was weighted TypeScript rather than an actual ML framework artifact | High | Fixed: trained TensorFlow.js architecture, weights, training script and accuracy verifier are committed |
| P80-003 | Community active navigation could miss a section inserted after lazy loading | Medium | Fixed: the observer now watches dynamically inserted navigation targets without removing code splitting |
| P80-004 | Date fields and campus map did not use the submitted React Datepicker/Leaflet technologies | High | Fixed: shared React Datepicker inputs and a React-Leaflet map/geolocation flow are wired |
| P80-005 | Deadline reminders lacked native scheduling | High | Fixed: Capacitor Local Notifications schedules/cancels alerts with browser and in-app fallbacks |
| P80-006 | Scholarship matching, parent report and bulk maintenance workflow were absent | High | Fixed: verified scholarship API/UI, shareable PDF progress report and validated CSV draft import added |
| P80-007 | Admins could verify records but not correct their fields | High | Fixed: protected inline editing writes an `EDIT_CONTENT` audit record |
| P80-008 | Android and iOS native projects still used Capacitor default branding | Medium | Fixed: EduPath launcher icons, adaptive icon and splash assets generated for both platforms |
| P80-009 | jsPDF 3.0.3 triggered a critical production dependency advisory | Critical | Fixed before release: upgraded to patched jsPDF 4.2.1; `npm run audit:critical` is enforced in CI |
| P81-001 | Campus map, external video/audio and resource upload existed but had no direct navigation entry | Medium | Fixed: desktop navigation, mobile menu and the student planning card now link naturally to the media/map hub |
| P81-002 | Malformed direct API uploads could receive one generic schema error even though the browser UI already differentiated size and type failures | Low | Fixed: server schema and oversized-body errors now return specific safe messages; API verification covers unsupported MIME types |
| P82-001 | A session saved by an older build could trigger parallel protected requests and appear as four runtime failures after expiry or server-key rotation | High | Fixed: expired JWTs are removed before mount; a server-rejected token is cleared once and recorded as one handled warning rather than duplicate failures |
| P82-002 | Desktop mouse navigation was incorrectly audited against mobile touch-target dimensions | Medium | Fixed: touch-size enforcement now runs for coarse-pointer or tablet/mobile layouts and reports exact compact controls; fine-pointer desktop layouts are assessed separately |
| P83-001 | Provider toggles and Leaflet's default zoom/attribution links were smaller than the 40 px touch audit threshold on mobile | Medium | Fixed: provider toggles use 44 px minimum height and Leaflet controls receive touch-only 40–44 px interactive areas |
| P84-001 | Eligibility result source pills were only 38 px high on the narrow responsive layout | Low | Fixed: every program source link now provides a 44 px minimum touch target while preserving wrapped text |
| P90-001 | Every institution displayed the same unrelated neural-network video and generic pronunciation audio | High | Fixed: hardcoded media was removed; verified institution/global media is preferred and a bundled admission-specific video plus local spoken guide provide honest fallbacks |
| P90-002 | Uploaded or newly entered media had no verification state and could not follow the academic content review workflow | Critical | Fixed: media now has incremental database migration, pending/verified/outdated/rejected states, protected admin forms, URL validation and public verified-only filtering |
| P90-003 | Several network-backed workflow actions changed state without a persistent working indicator | Medium | Fixed: admission, reminder, community and admin reporting actions expose live saving/loading feedback while synchronous navigation remains immediate |
| P90-004 | The in-app QA panel did not exercise the app in a real browser or retain traces/screenshots | High | Fixed in source: Playwright covers desktop/mobile sections, demo login, APIs, console/page/network failures and latency; CI retains HTML/JSON reports. First local browser binary download remains a one-time environment step |
| P91-001 | Campuses without a published video still had an empty media panel | Medium | Fixed: one reviewed global fallback can serve all campuses, followed by a bundled rights-safe EduPath admission guide |
| P91-002 | Audio records could not be selected according to the active Bangla/English preference | Medium | Fixed: media language metadata and deterministic institution/global/local/device fallback precedence were added |
| P91-003 | A fresh source archive installed dependencies without generating Prisma Client from the nested API schema, causing cascading TypeScript and Playwright startup failures | Critical | Fixed: the root `postinstall` lifecycle now generates Prisma Client automatically; release verification guards the install contract |
| P91-004 | Playwright treated intentional real-time stream teardown as a network failure and used immediate visibility probes before responsive UI rendering settled | High | Fixed: only aborted first-party real-time streams are ignored; the test waits for the app, follows the configured viewport breakpoint and targets stable desktop/mobile auth identifiers |
| RC2-001 | Desktop and mobile account-flow tests could continue while an authentication overlay remained above the signed-in shell | High | Fixed: authenticated state now makes the auth modal structurally impossible to render; the overlay has a stable test identity and acceptance waits for its complete DOM removal before interacting with account or navigation controls |
| RC2-002 | Account & privacy dialog was labelled by the signed-in student name, so semantic role queries and screen readers did not identify the dialog by purpose | High | Fixed: the visible bilingual Account & privacy label now owns `aria-labelledby`; the user name remains dialog content and an operations regression test protects the contract |
| RC2-003 | Authentication overlay used an exit-presence lifecycle for a security boundary; in real Playwright desktop/mobile runs the DOM overlay remained after demo session success and blocked subsequent account/navigation interactions | High | Fixed: successful authentication closes auth state explicitly, session state also enforces closure, and AuthModal returns null immediately when closed; release/ops regressions now reject reintroduction of delayed presence unmounting |
| RC2-004 | Local Playwright runs could silently reuse stale services already listening on ports 4000/5173, so acceptance results did not always belong to the source under test | High | Fixed: E2E owns dedicated strict ports, forces demo mode, never reuses an existing server, and verifies APIs through the same-origin preview proxy |

Phase 7 Android blockers are resolved on the student's phone. The remaining Phase 7.1 control and external-integration findings are tracked in `docs/PHASE_7_1_AUDIT.md` and must be closed before the final release candidate.

## Environment limitations, not application bugs

- This build container has Java 17 and no Android SDK/ADB. Capacitor 8 generates Java 21 source settings and compileSdk 36, so APK assembly must run in the student's Android Studio environment.
- First-time Gradle/SDK downloads require internet but use free tooling.
- Live Firebase, Supabase and Gemini modes require their free-tier credentials; key-free demo mode remains available.
- A production Android release requires an HTTPS API. Google Play registration is a separate store charge.
- iOS uses the same application source but compiling/signing it requires macOS/Xcode.

## New defect template

- ID:
- Device/Android version:
- Build/API URL:
- Steps to reproduce:
- Expected:
- Actual:
- Screenshot/log:
- Severity:
- Resolution:
| RC2-SEC-001 | npm audit --omit=dev still included Prisma devOptional/optional-peer tooling and unused Firebase Admin optional SDK branches, making the release gate report non-shipped dependency findings as runtime findings | High | Fixed: persistent API image and runtime audit now omit dev + optional trees; tooling remains separately critical-gated and residual Prisma advisory is documented |
