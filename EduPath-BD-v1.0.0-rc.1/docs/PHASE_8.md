# Phase 8 — Consolidated feature-integrity release

Version: 0.8.4

Phase 8 closes the code-level gaps found during the post-Phase-7 review and adds the professional modules promised in the project scope. It does not replace real external-service acceptance with simulated claims.

## Core integrity corrections

- Eligibility now evaluates current verified `AdmissionRule` records instead of a disconnected client formula.
- SSC, HSC, academic group and GPA criteria are evaluated per program and return official source links.
- A trained TensorFlow.js dense model, weights, training script and metric verifier replace the earlier weighted placeholder. The model ranks fit only; it cannot override admission eligibility.
- Lazy Community navigation remains observable after code-split content enters the DOM.

## Submitted technology alignment

- React Datepicker is used for deadline and circular date fields.
- React-Leaflet/Leaflet with OpenStreetMap provides the default map and nearest-campus geolocation.
- Google Maps Embed is available only when an optional restricted key is configured.
- Capacitor Local Notifications schedules deadline alerts on supported native devices and keeps browser/in-app fallback behavior.
- The Capacitor iOS native project is committed; signed iOS builds still require macOS/Xcode.
- Android and iOS launcher icons and splash screens use the EduPath brand instead of Capacitor defaults.
- Firebase Phone Auth OTP is implemented with a free fictional-number test mode. Real SMS billing is not misrepresented as free.
- Supabase PostgreSQL is detected explicitly through the health endpoint when its database URL is configured.

## Professional additions

- Verified scholarship matching by stage, academic group and GPA, with save/reminder actions.
- Parent/guardian PDF progress report generated from the signed-in student's real shortlist, applications and checklist.
- Admin bulk CSV institution import with quoted-field parsing, validation, row-level errors and draft-only publication safety.
- Admin content field editing with role protection and database audit logging.
- C# WinForms Crystal Reports viewer source plus the existing XSD, sample CSV and PostgreSQL reporting views.
- Campus map, video, audio and upload resources are directly reachable from desktop navigation, the mobile menu and the student planning dashboard.
- Browser and direct-API upload failures distinguish unsupported type, empty content, oversize payload and binary-signature mismatch.
- Persisted JWT expiry is checked before protected screens mount, and a server-rejected legacy session is safely cleared once without duplicate false runtime failures.
- Automatic QA applies touch-target rules to actual touch/tablet/mobile layouts and reports affected control names and dimensions.
- Map provider, zoom, popup and attribution controls use mobile-safe 40–44 px touch areas.
- Eligibility program source pills retain 44 px touch targets at narrow widths.

## Repeatable evidence

Run `npm run qa`. This checks type safety, unit tests, model integrity, API workflows, release files and the production web build. The Android project can then be built with `npm run android:debug -- --api-url http://YOUR_LAPTOP_IP:4000 --install` using JDK 21.

## External acceptance still required

- Configure Firebase fictional phone credentials and capture OTP proof.
- Configure a free Supabase project and capture PostgreSQL/Storage proof.
- Configure a Gemini developer key if the teacher requires a live generative response rather than the labelled key-free fallback.
- Open the supplied Windows Crystal project after SAP Crystal Reports is installed and save the final designed `.rpt`.
- Build/sign iOS only on a Mac with Xcode.
- Push the final repository to the student's GitHub and retain a green CI run.
