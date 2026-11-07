# Phase 7.1 — Truthful completion audit

Audit date: 2026-09-12 (consolidated update)

This document separates source-code implementation, repeatable demo proof and production integration. A requirement is only `Complete` when the current repository contains the implementation and repeatable evidence. `Implemented — runtime proof pending` means the production path exists but still needs the named free service configured and demonstrated. `Partial` means material work remains.

## Teacher requirements

| # | Requirement | Current evidence | Honest status | Remaining exit check |
|---:|---|---|---|---|
| 1 | Scalable PDF ERD | `output/pdf/EduPath-BD-ERD.pdf` and Prisma schema | Complete | Open the vector PDF and zoom during presentation |
| 2 | Real-time comments from own DB | PostgreSQL repository, REST write and SSE/Socket broadcast; API verifier covers storage + stream | Implemented — runtime proof pending | Configure free PostgreSQL and demonstrate two clients |
| 3 | Like/dislike with live count | Unique database vote and server totals broadcast live | Implemented — runtime proof pending | Demonstrate two clients against PostgreSQL |
| 4 | Live unique username check | Debounced UI request, reserved rules and DB lookup route | Implemented — runtime proof pending | Demonstrate registration against PostgreSQL/Firebase |
| 5 | Email and phone verification | Firebase verified-email flow plus genuine Phone Auth OTP and fictional-number test mode | Implemented — runtime proof pending | Configure Firebase fictional phone/OTP and capture a zero-cost verification |
| 6 | Multiple inputs/dropdowns | Profile, catalog, authentication and admin forms | Complete | Physical-phone form/keyboard test |
| 7 | Real-time rating | Unique account rating, aggregate/distribution and live broadcast | Implemented — runtime proof pending | Demonstrate two clients against PostgreSQL |
| 8 | Pagination | Server metadata and institution/comment controls | Complete | Phone next/previous test |
| 9 | External audio/video | YouTube privacy embed and external HTML audio | Complete | Test classroom network and keep fallback evidence |
| 10 | Map/location | Leaflet/OpenStreetMap campus map, selector and nearest-campus geolocation; optional Google embed | Complete | Test map and permission on phone/network |
| 11 | Session/JWT login/logout | Firebase-to-app session, signed JWT, roles and mobile/desktop sign-out | Complete | Retest mobile logout and expired session |
| 12 | TensorFlow Lite or equivalent on-device ML | Trained TensorFlow.js dense network, committed weights, offline inference and repeatable model verifier | Complete | Show the model artifact and offline prediction |
| 13 | Cloud upload/display | Authenticated validation, Supabase adapter and media preview | Implemented — runtime proof pending | Configure free Supabase bucket and upload from phone |
| 14 | Datepicker | React Datepicker student range and admin circular date inputs | Complete | Validate reversed/invalid ranges in UI |
| 15 | GSAP/Framer Motion | Framer Motion transitions and reduced-motion support | Complete | Visual phone check |
| 16 | SASS/Tailwind | Tailwind responsive design system | Complete | None beyond build proof |
| 17 | Git/Vite | Vite workspaces and local Git history | Partial delivery proof | Push clean repository to the student's GitHub |
| 18 | GraphQL/modern API | Apollo `/graphql` institution queries | Complete foundation | Add verifier request and show one query |
| 19 | REST/SOAP | Express REST API covers application features | Complete via REST | Show API verifier/output |
| 20 | Crystal Report | Protected dataset/CSV, XSD, PostgreSQL views and C# WinForms viewer source | Partial external artifact | Create/save the final proprietary `.rpt` on Windows and capture report evidence |
| 21 | Modern cross-platform frontend | React/TypeScript/Capacitor with committed Android and iOS projects; Android APK proven | Implemented — iOS build proof pending | Compilation/signing requires macOS/Xcode |
| 22 | Docker/CI/CD | Compose/Docker and GitHub Actions workflow files exist | Partial delivery proof | Push to GitHub and obtain a green Actions run |
| 23 | Generative AI API | Gemini server adapter plus clearly labelled deterministic fallback | Implemented — runtime proof pending | Configure a free Gemini key and capture a response labelled `gemini` |
| 24 | Teacher additions/bonus features | Bilingual/PWA, compare, shortlist, tracker, native reminders, scholarship matching, parent PDF, CSV import, admin edit/moderation/analytics and diagnostics | Current extras implemented | Record and trace every later teacher request before final freeze |

## Phase 7.1 UI/control findings

| ID | Finding | Severity | Resolution/state |
|---|---|---|---|
| P71-001 | Header notification bell had no action | High | Fixed: opens a persistent reminder center |
| P71-002 | Pathway `Explore` buttons had no action | High | Fixed: selects the pathway, generates matching results and scrolls to eligibility |
| P71-003 | Mobile `Profile` opened the institution catalog | High | Fixed: bottom navigation now contains only correctly mapped major destinations |
| P71-004 | Mobile bottom navigation always marked Home active | Medium | Fixed: active state follows the visible major section |
| P71-005 | Hero claimed 120+ institutions and 450+ programs although the current catalog is smaller | High | Fixed: public API supplies exact verified catalog totals |
| P71-006 | Hero dashboard displayed invented progress, deadline and shortlist totals | High | Fixed: replaced by four real, clickable planning actions |
| P71-007 | Compare silently ignored a fourth selection | Medium | Fixed: limit and add/remove actions now show clear feedback |
| P71-008 | Application status/checklist writes lack local error recovery | Medium | Fixed: failed writes are caught and shown without corrupting local state |
| P71-009 | Native Android background notification was not implemented | Medium | Fixed: Capacitor Local Notifications schedules and cancels deadline alerts, with browser fallback |
| P71-010 | Institution cards did not expose official web/source actions | Medium | Fixed: available website and official-source links are visible per card |
| P71-011 | Invalid/reversed deadline ranges and reminder messages had poor feedback placement | Medium | Fixed: date constraints, inline validation and deadline-local status feedback added |

## Release rule

Do not describe `Partial` or `runtime proof pending` rows as fully production-complete. The key-free demo remains the presentation fallback, while PostgreSQL, Firebase, Supabase and Gemini are configured and proven separately before the final release candidate.
