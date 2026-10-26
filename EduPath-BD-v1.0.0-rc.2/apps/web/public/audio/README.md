# Local bilingual admission guide

The application supports a language-aware local recording without pretending that a placeholder is a finished voice asset.

1. Generate the approved scripts in this directory as `edupath-guide-bn.mp3` and `edupath-guide-en.mp3`.
2. Set `VITE_GUIDE_AUDIO_BN_URL=/audio/edupath-guide-bn.mp3` and `VITE_GUIDE_AUDIO_EN_URL=/audio/edupath-guide-en.mp3`.
3. Rebuild the web/Android application.

Selection order is: verified institution recording for the active language, verified global recording, configured local recording, then device speech synthesis.
