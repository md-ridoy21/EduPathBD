# Free service setup and honest limits

EduPath BD remains fully runnable in `DEMO_MODE=true` without any API key. The integrations below are optional production adapters; the application keeps its local/demo fallback when a key is absent.

## Supabase PostgreSQL and Storage

1. Create a Supabase free project.
2. Copy the PostgreSQL connection string into `DATABASE_URL` and add `?pgbouncer=true&connection_limit=1` when using the transaction pooler.
3. Create a private Storage bucket named `edupath-media` (Public bucket must stay off). Set its file-size limit to 5 MB and allow only PDF, JPG/JPEG, PNG, WebP, MP3, WAV and OGG MIME types.
4. Create a dedicated Supabase `sb_secret_...` server key and set it as `SUPABASE_SECRET_KEY` with `SUPABASE_URL` and `SUPABASE_STORAGE_BUCKET` only on the API server. Never put a secret/service-role key in Vite variables or the Android bundle. `SUPABASE_SERVICE_ROLE_KEY` is accepted only as a legacy migration fallback.
5. Run `npm run db:migrate:deploy` and then `npm run db:seed`. The default seed loads only the starter catalog; it deliberately excludes demo users and community activity.
6. Start the API with `DEMO_MODE=false`. `/api/health` must report `databaseProvider: "supabase-postgresql"`, `database: true` and `supabaseStorage: true`.

The database code is standard Prisma PostgreSQL, so local Docker PostgreSQL and Supabase use the same schema and repository methods.

Uploaded files remain private. The API stores an internal object reference and issues a one-hour signed URL only when an authenticated uploader, reviewer, or eligible public media request needs the file. Never change the bucket to public to make a preview work.

## Firebase email and phone authentication

- Register a Firebase Web app and copy only its public configuration into `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` and `VITE_FIREBASE_APP_ID` before building the web or Capacitor app.
- Set `FIREBASE_PROJECT_ID` on the API server. For local/operator runs, keep the downloaded Admin SDK service-account JSON outside the repository and point `GOOGLE_APPLICATION_CREDENTIALS` to that file. `FIREBASE_SERVICE_ACCOUNT_JSON` remains available for secret managers that inject a single protected value. Never use either Admin credential in a `VITE_` variable.
- Email/password registration and email verification work with the Firebase Spark/free tier.
- Phone Auth is implemented with the official Firebase OTP flow.
- For a no-cost academic demo, add a fictional phone number and six-digit code in Firebase Console and set `VITE_FIREBASE_PHONE_TEST_MODE=true`. Firebase sends no SMS in this mode.
- Real user SMS verification requires Firebase's Blaze/pay-as-you-go plan. Set test mode to `false` only after enabling billing and production abuse controls.
- Add the web domain to Firebase Authorized domains. For a native Android build, configure the Android app/SHA fingerprints if the chosen Firebase flow requires them.

The four `VITE_FIREBASE_*` web-app values identify the Firebase project and are expected to be present in client bundles; they are not Firebase Admin credentials. Restrict the web API key in Google Cloud to the required Firebase APIs and approved web origins. The downloaded service-account JSON is privileged and must remain server-only.

## AI

- Without `GEMINI_API_KEY`, EduPath uses its labelled deterministic, source-aware assistant.
- With a free Gemini developer key, the same endpoints use the configured Gemini model. Usage remains subject to Google's current free-tier quota.
- Eligibility never depends on Gemini: verified admission rules remain authoritative and the trained TensorFlow.js model only supplies a fit score.

## Maps

- Leaflet + OpenStreetMap is the default and needs no API key.
- `VITE_GOOGLE_MAPS_EMBED_KEY` optionally enables a Google Maps campus view. Keep the key restricted to the required API and allowed origins.

## iOS

The Capacitor iOS source project is included and shares the React code. Apple requires macOS/Xcode for compilation and signing; Linux/Windows cannot produce a signed iOS application.
