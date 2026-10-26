# Phase 4 - Community, Media, Maps and Reminders

## Delivered

- Database-backed institution discussion rooms
- Real-time comments and nested replies
- One like/dislike vote per user and comment
- Live vote totals broadcast only after server-side persistence
- One 1–5 star rating per user and institution
- Live average, count and rating distribution
- Server-Sent Events for dependency-free web/mobile live updates
- Socket.IO room compatibility retained for the submitted technology list
- PDF, image and audio upload with authentication, MIME allow-list and 5 MB limit
- Supabase Storage production adapter and key-free demo preview adapter
- Uploaded image, audio and PDF display
- Privacy-enhanced external YouTube embed and external HTML audio
- OpenStreetMap campus view without a paid API key
- Persistent deadline reminder list, service worker notification and in-app fallback
- Community starter content in the repeatable PostgreSQL seed

## Reliable classroom demo

1. Run `npm run dev` with `DEMO_MODE=true`.
2. Sign in with **Student demo**.
3. Open **Community**, submit a comment and reply, then like/dislike it.
4. Select a star rating and watch the average/distribution update.
5. Open the same app in a second browser window to demonstrate live updates.
6. In **Campus and learning resources**, change the map campus and play video/audio.
7. Upload a small JPG, MP3 or PDF and show its immediate preview.
8. Select **Remind me** on a deadline and allow browser notifications.

## Free Supabase Storage setup

1. Create a public bucket named `edupath-media` in the free Supabase project.
2. Put the project URL and service-role key only in the API `.env` file.
3. Keep the service-role key out of the web app and Git.
4. Set `SUPABASE_STORAGE_BUCKET=edupath-media` and `DEMO_MODE=false`.

The backend validates authentication, MIME type and decoded byte size before any cloud upload. The service-role key is never sent to the mobile client.

## Notification scope

Deadline reminders persist locally and use the browser/PWA service worker when notification permission exists. An in-app saved-reminder fallback works when notification permission is unavailable. Native background scheduling can be added later through the free Capacitor Local Notifications plugin without changing the reminder data contract.

## Verification

```bash
npm run typecheck
npm test
npm run verify:api
npm run build
npm run cap:sync --workspace @edupath/web
```

The live verifier covers 24 catalog, identity, authorization, workflow, community, rating, real-time and upload scenarios.
