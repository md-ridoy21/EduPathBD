# Android release checklist

## One-time workstation setup

- Install Android Studio, Android SDK Platform 36 and OpenJDK 21. Set `JAVA_HOME` to JDK 21; the current Android Studio JBR may be Java 25, which Gradle 8.14.3 cannot run.
- Enable Developer options and USB debugging on the physical Android phone.
- Run `npm install` at the repository root.

## Classroom debug build

1. Run `npm run android:doctor` and resolve every `FAIL`.
2. Start the API with `npm run dev:api` and find the laptop LAN address with `hostname -I`.
3. Connect one authorized USB-debugging phone.
4. Run `npm run android:debug -- --api-url http://LAPTOP_IP:4000 --install`.
5. Open the app footer → **Device check** and confirm that the backend reports v1.1.0-rc.1.

Debug builds alone permit the LAN HTTP address. Release builds reject cleartext traffic and must use an HTTPS API.
The debug builder conditionally enables WebView mixed content only when the supplied API URL explicitly uses local HTTP; HTTPS builds keep it disabled.

## Signed release / Play Store

1. Deploy the API and PostgreSQL database behind HTTPS.
2. Set production environment values and `DEMO_MODE=false`; keep service-role and Gemini keys only on the API server.
3. Build the web app with the HTTPS `VITE_API_URL`, then run Capacitor sync.
4. In Android Studio choose **Generate Signed Bundle / APK**, create and securely back up a keystore, then generate an Android App Bundle.
5. Test the signed bundle through Play Console internal testing before production review.

Publishing is not completely free: development and local APK sharing are free, but Google Play charges its own developer registration fee. iOS uses the same source code, while compiling/signing an iOS release requires macOS, Xcode and an Apple developer setup.

## Physical-device acceptance checks

- Fresh install and launch; Bangla/English switch survives restart.
- Student and admin demo login; logout and expired-session handling.
- Catalog filters, pagination, comparison, shortlist and application checklist.
- Date filters and reminders; denied notification permission still keeps in-app reminder.
- AI cited fallback without key and Gemini mode with a free key.
- Comments/replies, live like/dislike, rating and report/moderation.
- PDF/image/audio upload validation, YouTube/audio playback and OpenStreetMap.
- Turn network off: shell loads, cached public catalogs remain readable and private writes show an error.
- Rotation, keyboard, screen-reader labels and 360 px-wide layout.
