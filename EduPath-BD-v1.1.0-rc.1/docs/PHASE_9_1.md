# Phase 9.1 — professional media fallback

Version: 0.9.1

## Delivered

- Institution-specific verified video remains the first choice.
- A verified global admission video can be published from the same admin review workflow without duplicating a URL on the institution model.
- When neither record exists, the app plays a bundled, rights-safe EduPath admission-planning video instead of showing unrelated or empty media.
- Media resources support `en`/`bn` language metadata. Audio selection prefers the selected institution and active app language, then a verified global recording.
- Optional local recordings can be placed in `apps/web/public/audio/` and configured with `VITE_GUIDE_AUDIO_BN_URL` and `VITE_GUIDE_AUDIO_EN_URL`.
- If no verified or configured recording exists, browser speech synthesis reads an institution-specific bilingual guide.

## Media precedence

### Video

1. Verified institution YouTube resource
2. Verified global YouTube resource
3. Bundled EduPath admission-planning MP4

### Audio

1. Verified institution recording matching the active language
2. Verified language-neutral institution recording
3. Verified global recording matching the active language
4. Verified language-neutral global recording
5. Configured local Bangla/English MP3
6. Device speech synthesis

Every admin-created resource stays pending until explicitly verified.
