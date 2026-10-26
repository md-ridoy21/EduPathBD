# Free service setup and honest limits

EduPath BD remains fully runnable in `DEMO_MODE=true` without any API key. The integrations below are optional production adapters; the application keeps its local/demo fallback when a key is absent.

## Supabase PostgreSQL and Storage

1. Create a Supabase free project.
2. Copy the PostgreSQL connection string into `DATABASE_URL` and add `?pgbouncer=true&connection_limit=1` when using the transaction pooler.
3. Create a private Storage bucket named `edupath-media`.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_STORAGE_BUCKET` only on the API server. Never put the service-role key in Vite variables or the Android bundle.
5. Run `npm run db:deploy -w @edupath/api` and `npm run db:seed -w @edupath/api`.
6. Start the API with `DEMO_MODE=false`. `/api/health` must report `databaseProvider: "supabase-postgresql"`, `database: true` and `supabaseStorage: true`.

The database code is standard Prisma PostgreSQL, so local Docker PostgreSQL and Supabase use the same schema and repository methods.

## Firebase email and phone authentication

- Email/password registration and email verification work with the Firebase Spark/free tier.
- Phone Auth is implemented with the official Firebase OTP flow.
- For a no-cost academic demo, add a fictional phone number and six-digit code in Firebase Console and set `VITE_FIREBASE_PHONE_TEST_MODE=true`. Firebase sends no SMS in this mode.
- Real user SMS verification requires Firebase's Blaze/pay-as-you-go plan. Set test mode to `false` only after enabling billing and production abuse controls.
- Add the web domain to Firebase Authorized domains. For a native Android build, configure the Android app/SHA fingerprints if the chosen Firebase flow requires them.

## AI

- Without `GEMINI_API_KEY`, EduPath uses its labelled deterministic, source-aware assistant.
- With a free Gemini developer key, the same endpoints use the configured Gemini model. Usage remains subject to Google's current free-tier quota.
- Eligibility never depends on Gemini: verified admission rules remain authoritative and the trained TensorFlow.js model only supplies a fit score.

## Maps

- Leaflet + OpenStreetMap is the default and needs no API key.
- `VITE_GOOGLE_MAPS_EMBED_KEY` optionally enables a Google Maps campus view. Keep the key restricted to the required API and allowed origins.

## iOS

The Capacitor iOS source project is included and shares the React code. Apple requires macOS/Xcode for compilation and signing; Linux/Windows cannot produce a signed iOS application.
