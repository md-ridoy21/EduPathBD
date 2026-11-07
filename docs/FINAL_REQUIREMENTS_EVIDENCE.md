# Final requirements evidence

Run these commands before the presentation:

```bash
npm run typecheck
npm test
npm run verify:api
npm run verify:release
npm run build
npm run cap:sync -w @edupath/web
npm run android:doctor
```

The authoritative 24-item mapping is in `docs/REQUIREMENTS_TRACEABILITY.md`. Presentation evidence is grouped below.

| Evidence group | Requirements demonstrated | Where to show it |
|---|---|---|
| Data design | Scalable PDF ERD | `output/pdf/EduPath-BD-ERD.pdf` |
| Identity/security | Live username, verified email, JWT/session and roles | Authentication modal and protected admin request |
| Admission workflow | Inputs/dropdowns, pagination, React Datepicker, database eligibility, comparison, application plan and scholarships | Student dashboard |
| Social proof | Real-time comments/replies, like/dislike and rating | Community section in two tabs/devices |
| Rich content | External video/audio, cloud media, Leaflet map and nearest-campus location | Media and campus section |
| Intelligence | Trained on-device TensorFlow.js prediction plus source-aware generative AI | Eligibility result and Edu AI result mode/citations |
| APIs/frontend | REST, GraphQL, React, Tailwind, Framer Motion, Vite and Capacitor | Source tree and live app |
| Delivery | Git, Docker, CI/CD, offline PWA, accessibility and localization | Commit history, workflow and offline/language demo |
| Reporting | Parent PDF, protected dataset/CSV, XSD, PostgreSQL views and Crystal Windows viewer source | Plan tab, admin analytics and `reports/crystal` assets |

## Honest external completion points

- Live Gemini generation needs a free Gemini API key; the key-free mode is a deterministic, source-aware fallback and is labelled as such.
- Firebase email uses the free tier; the no-cost phone demo uses Firebase fictional numbers. Real phone SMS requires Blaze billing.
- Live Supabase Storage and PostgreSQL use free-tier project credentials; demo adapters need none.
- The final visual Crystal Reports `.rpt` file must be authored/saved in free SAP Crystal Reports for Visual Studio on Windows using the supplied data assets.
- Android source and native project are ready; final physical-device acceptance and signed bundle require the student's phone/Android Studio. iOS compilation requires a Mac even though the application code is shared.
