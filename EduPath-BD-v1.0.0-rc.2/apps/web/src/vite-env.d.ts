/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_PHONE_TEST_MODE?: "true" | "false";
  readonly VITE_GOOGLE_MAPS_EMBED_KEY?: string;
  readonly VITE_GUIDE_AUDIO_BN_URL?: string;
  readonly VITE_GUIDE_AUDIO_EN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
