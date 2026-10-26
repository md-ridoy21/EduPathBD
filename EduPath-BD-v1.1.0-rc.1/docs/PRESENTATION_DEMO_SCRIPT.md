# Presentation and demo script

Target length: 10–12 minutes. Keep the API and web app running before presenting. Use `student_demo` and `admin_demo`; demo mode needs no cloud key.

## 1. Problem and solution — 45 seconds

Bangladeshi students face fragmented, changing education, admission and career information after SSC/HSC. EduPath BD combines verified discovery, decision support, application planning and community evidence in one cross-platform app.

## 2. Architecture — 60 seconds

Show the scalable PDF ERD. Explain the shared React/Capacitor Android–iOS–PWA client, Express REST and Apollo GraphQL API, PostgreSQL/Prisma data, Firebase verified identity, Supabase media, real-time SSE/Socket channels and source-aware Gemini adapter. Clarify that demo adapters preserve the same contracts when free cloud services are unavailable.

## 3. Student journey — 4 minutes

1. Switch Bangla/English and show the responsive/PWA shell.
2. Enter SSC/HSC profile; show deterministic eligibility and the explainable on-device pathway prediction.
3. Search/filter institutions, move through pagination and compare three choices.
4. Sign in as `student_demo`, shortlist an institution and track a program.
5. Change application status, tick a document and filter the deadline calendar with datepickers.
6. Ask Edu AI a Bangla question; point to its mode, cited records, official links and safety notice.

## 4. Community, media and location — 2 minutes

Open an institution discussion, create a reply, like/dislike it and watch totals update. Submit a 1–5 rating and a source-verification report. Show the external video, audio player, validated upload preview and OpenStreetMap campus selector.

## 5. Admin and reports — 2 minutes

Sign in as `admin_demo`. Create a sourced institution/program/circular draft, explain verification state, open analytics, resolve the submitted report and download CSV/JSON reporting data. State honestly that the free Crystal Reports `.rpt` layout is saved on Windows Visual Studio from the included XSD/sample data.

## 6. Reliability and close — 60 seconds

Open footer → **Device check** to show the Android/PWA runtime, API v1.1.0-rc.1 and storage/network readiness. Turn the network off and reload once after an online visit: the PWA shell and cached public catalog remain available. Explain JWT/role guards, validation, origin allow-list, rate limits, private-data non-caching and production HTTPS. Close with: “The application supports the demonstrated assessed workflow today, while the completion audit clearly tracks every remaining external integration, official data import and teacher addition.”

## Backup plan

- Keep screenshots of the ERD, student flow and admin analytics.
- Keep demo mode enabled if Firebase, Supabase, Gemini or internet is unavailable.
- Never claim fallback text is live generative AI; show the mode badge.
- Keep the Phase 6 ZIP, ERD PDF and last successful verification output locally.
