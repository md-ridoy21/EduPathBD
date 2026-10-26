# Phase 7 — Android device validation and release tooling

Phase 7 prepares EduPath BD v0.7.0 for repeatable physical-phone builds and presentation-day diagnostics.

## Delivered

- One-command Android environment doctor for Node, Java, SDK 36, platform-tools and connected phone checks
- Safe build command that rejects `localhost`, embeds a LAN/HTTPS API URL, syncs Capacitor, assembles a debug APK and optionally installs it with ADB
- Bilingual in-app Device Check for runtime, network, API version/latency, local storage, notification, PWA and viewport checks
- Versioned output name: `output/android/EduPath-BD-v0.7.0-debug.apk`
- Phone acceptance-test sheet and transparent bug/limitation log
- API and Android application versions aligned at 0.7.0

## Fastest phone workflow

```bash
npm run android:doctor
hostname -I
npm run dev:api
npm run android:debug -- --api-url http://YOUR_LAPTOP_IP:4000 --install
```

The laptop and phone must be on the same Wi-Fi network. Ubuntu firewall must allow TCP port 4000 for the local demo. The API must be started with a host binding reachable from the LAN; see the phone acceptance guide.

Use JDK 21 for terminal and Android Studio Gradle builds. If the bundled Android Studio JBR reports Java 25, do not use it with Gradle 8.14.3; export the OpenJDK 21 path as `JAVA_HOME` for the terminal session.

## Production boundary

The generated debug APK may call a private LAN HTTP API because its debug manifest explicitly permits cleartext traffic. A signed release/Play Store build must use an HTTPS API. Signing keys and cloud secrets are never committed.
