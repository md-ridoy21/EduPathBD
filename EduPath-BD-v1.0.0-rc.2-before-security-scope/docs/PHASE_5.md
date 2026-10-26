# Phase 5 - Intelligence, Moderation and Reports

## Delivered

- Authenticated source-aware education/admission AI assistant
- Gemini REST adapter with a key-free deterministic demo and failure fallback
- One-tap AI summary for labelled admission circulars
- AI response evidence cards, official links, model/mode label and safety notice
- Stored AI interaction audit trail with feature, prompt, response, model and source IDs
- Fully on-device pathway-fit inference with bundled weights, version and explanations
- User comment report modal with controlled reasons and optional details
- Admin moderation queue with review, resolve and dismiss transitions
- Admin application, rating, engagement, report and AI activity analytics
- Protected JSON reporting dataset and UTF-8 CSV downloads
- Crystal Reports-ready XSD, sample CSV and PostgreSQL reporting views
- Four-page vector A3 ERD PDF with entities, keys, relationships and delete behavior

## Reliable classroom demo

1. Run `npm run dev` with `DEMO_MODE=true`.
2. Sign in with **Student demo** and open **Ask Edu AI**.
3. Ask a quick question and show that the answer includes labelled source records.
4. Select a circular and use the document button to create a one-record summary.
5. Run the eligibility form offline and show the local model version and reasons.
6. In Community, report a comment with **Source needs verification**.
7. Sign out, use **Admin demo**, open the Control Center and resolve the report.
8. Download analytics and moderation CSV datasets.
9. Present `output/pdf/EduPath-BD-ERD.pdf` at any zoom level.

## Free production-style AI setup

Set `GEMINI_API_KEY` in the API environment. `GEMINI_MODEL` defaults to `gemini-2.5-flash-lite` but remains configurable so model retirement does not require a code change. Never put the key in `VITE_*` variables or the mobile bundle.

If the key, network or quota is unavailable, the API returns a labelled fallback response made only from local EduPath records. Admission dates, fees and final eligibility always require official-source verification.

## Crystal Reports handoff

The app itself produces protected, normalized data. The files in `reports/crystal/` allow the free SAP Crystal Reports Visual Studio developer edition on Windows 11 to consume the same fields through CSV, ADO.NET XSD or PostgreSQL views. Proprietary SAP runtime binaries and `.rpt` authoring cannot run in the Linux/Capacitor codebase, so the actual visual `.rpt` layout is intentionally a Windows designer step.

## Verification

```bash
npm run typecheck
npm test
npm run verify:api
npm run build
npm run cap:sync --workspace @edupath/web
```

The API verifier now covers AI, source linkage, reporting, moderation and earlier identity/catalog/community workflows.

