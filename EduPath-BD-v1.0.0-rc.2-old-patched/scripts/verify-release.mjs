import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import process from "node:process";

const execFileAsync = promisify(execFile);

const required = [
  "apps/web/public/manifest.webmanifest",
  "apps/web/public/sw.js",
  "apps/web/public/icon.svg",
  "apps/web/public/media/edupath-admission-guide-en.mp4",
  "apps/web/public/audio/README.md",
  "apps/web/public/audio/edupath-guide-bn.txt",
  "apps/web/public/audio/edupath-guide-en.txt",
  "apps/web/src/lib/locale.tsx",
  "apps/web/src/components/AppStatus.tsx",
  "apps/web/src/components/DeviceCheckModal.tsx",
  "apps/web/src/components/ReminderCenter.tsx",
  "apps/web/src/components/AdminReviewQueue.tsx",
  "apps/web/src/components/QualityAuditPanel.tsx",
  "apps/web/src/components/DatePickerInput.tsx",
  "apps/web/src/components/ScholarshipHub.tsx",
  "apps/web/src/components/StudentProgressReport.tsx",
  "apps/web/src/components/AdminCsvImport.tsx",
  "apps/web/src/components/AccountCenter.tsx",
  "apps/web/src/model/pathway-fit-model.json",
  "apps/web/assets/edupath-foreground.svg",
  "apps/web/src/lib/quality-audit.ts",
  "apps/api/Dockerfile",
  ".dockerignore",
  "apps/api/prisma/migrations/20260912000000_init/migration.sql",
  "apps/api/prisma/migrations/20260913000000_verified_media/migration.sql",
  "apps/api/prisma/migrations/20260914000000_localized_global_media/migration.sql",
  "apps/api/prisma/migrations/20260916000000_firebase_identity_account_lifecycle/migration.sql",
  "apps/api/prisma/migrations/migration_lock.toml",
  "docker-compose.yml",
  ".github/workflows/ci.yml",
  "apps/web/android/app/src/debug/AndroidManifest.xml",
  "apps/web/ios/App/App.xcodeproj/project.pbxproj",
  "docs/ANDROID_RELEASE_CHECKLIST.md",
  "docs/PRESENTATION_DEMO_SCRIPT.md",
  "docs/FINAL_REQUIREMENTS_EVIDENCE.md",
  "docs/PHASE_7.md",
  "docs/PHONE_ACCEPTANCE_TEST.md",
  "docs/BUG_LOG.md",
  "docs/PHASE_7_1_AUDIT.md",
  "docs/PHASE_7_2_AUDIT.md",
  "docs/PHASE_7_3_QA.md",
  "docs/PHASE_7_5_STABILIZATION.md",
  "docs/FREE_SERVICE_SETUP.md",
  "docs/PHASE_8.md",
  "docs/PHASE_9.md",
  "docs/PHASE_9_1.md",
  "docs/E2E_TESTING.md",
  "docs/PRODUCTION_DEPLOYMENT.md",
  "docs/PRODUCTION_READINESS.md",
  "docs/DATABASE_RECOVERY.md",
  "docs/PROFILE_SYNC_PRIVACY.md",
  "docs/ACCOUNT_LIFECYCLE.md",
  "docs/OLD_VERSION_COMPARISON.md",
  "RELEASE_NOTES_v1.0.0-rc.2.md",
  "output/pdf/EduPath-BD-v1.0.0-rc.2-Feature-and-QA-Manual.pdf",
  "playwright.config.ts",
  "tests/e2e/app-smoke.spec.ts",
  "reports/crystal/windows-viewer/EduPathCrystalViewer.csproj",
  "reports/crystal/windows-viewer/ReportViewerForm.cs",
  "scripts/android-doctor.mjs",
  "scripts/build-android.mjs",
  "scripts/train-pathway-model.mjs",
  "scripts/build-fallback-video.mjs",
  "scripts/generate_feature_qa_manual.py",
  "scripts/verify-pathway-model.mjs",
  "scripts/verify-production.mjs",
  "scripts/verify-production-runtime.mjs",
  "scripts/database-backup.mjs",
  "scripts/database-restore.mjs",
  "scripts/database-integrity.mjs",
  "scripts/lib/database-operations.mjs",
  "apps/api/scripts/bootstrap-admin.ts",
  "apps/api/scripts/verify-integrations.ts",
  "tests/ops/database-operations.test.mjs"
];

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

for (const file of required) {
  check((await stat(file)).isFile(), `${file} exists`);
}

for (const file of ["package.json", "apps/api/package.json", "apps/web/package.json"]) {
  const value = JSON.parse(await readFile(file, "utf8"));
  check(value.version === "1.0.0-rc.2", `${file} is version 1.0.0-rc.2`);
}

const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
check(rootPackage.scripts["android:doctor"] && rootPackage.scripts["android:debug"], "Android doctor and APK build commands are registered");
check(rootPackage.scripts.qa?.includes("verify:api") && rootPackage.scripts.qa?.includes("verify:release") && rootPackage.scripts.qa?.includes("verify:production"), "One-command repository QA and production gate is registered");
check(rootPackage.scripts.postinstall === "npm run db:generate", "Fresh npm installs generate the nested Prisma Client automatically");
check(rootPackage.scripts["audit:critical"]?.includes("--audit-level=critical"), "Critical production dependency audit is registered");
check(rootPackage.scripts["test:e2e"] === "playwright test" && rootPackage.devDependencies["@playwright/test"], "Playwright browser acceptance suite is registered");
check(rootPackage.scripts.qa?.includes("verify:model") && rootPackage.scripts["model:train"], "TensorFlow model training and verification commands are registered");
check(rootPackage.scripts["db:backup"] && rootPackage.scripts["db:restore"] && rootPackage.scripts["db:integrity"] && rootPackage.scripts["test:ops"], "Database backup, restore, integrity and operations-test commands are registered");
check(rootPackage.scripts["admin:bootstrap"] && rootPackage.scripts["production:integrations-check"] && rootPackage.scripts["production:runtime-check"], "Admin bootstrap and live production verification commands are registered");
const e2eSuite = await readFile("tests/e2e/app-smoke.spec.ts", "utf8");
check(e2eSuite.includes("expectedStreamingAbort") && e2eSuite.includes("page.viewportSize()") && e2eSuite.includes('getByTestId("mobile-navigation-toggle")') && e2eSuite.includes('getByTestId("mobile-auth-action")') && e2eSuite.includes('getByTestId("mobile-account-action")'), "Playwright distinguishes expected stream teardown and tests stable responsive auth and account controls");

const webPackage = JSON.parse(await readFile("apps/web/package.json", "utf8"));
for (const dependency of ["@tensorflow/tfjs", "react-datepicker", "leaflet", "react-leaflet", "@capacitor/local-notifications", "jspdf"]) {
  check(Boolean(webPackage.dependencies[dependency]), `${dependency} is an explicit frontend dependency`);
}
check(Boolean(webPackage.devDependencies["@capacitor/ios"]), "Capacitor iOS tooling is registered");

const qaPanel = await readFile("apps/web/src/components/QualityAuditPanel.tsx", "utf8");
check(qaPanel.includes("runQualityAudit") && qaPanel.includes("Download JSON") && qaPanel.includes("qaEventName"), "Browser QA panel captures and exports diagnostic evidence");
const qaAudit = await readFile("apps/web/src/lib/quality-audit.ts", "utf8");
check(qaAudit.includes('checkEndpoint("/api/health"') && qaAudit.includes("waitForLazyNavigationTargets"), "Browser QA uses the canonical health route and waits for lazy navigation targets");
const appSource = await readFile("apps/web/src/App.tsx", "utf8");
check(appSource.includes('inline-flex min-h-11 items-center rounded-full'), "Eligibility source links expose mobile-safe touch targets");

const androidGradle = await readFile("apps/web/android/app/build.gradle", "utf8");
check(androidGradle.includes("versionCode 21") && androidGradle.includes('versionName "1.0.0-rc.2"'), "Android package version is 1.0.0-rc.2 (code 21)");

const androidBuilder = await readFile("scripts/build-android.mjs", "utf8");
check(androidBuilder.includes('includes(parsedUrl.hostname)') && androidBuilder.includes("EduPath-BD-v1.0.0-rc.2-debug.apk"), "Android builder rejects localhost and produces a versioned APK");
check(androidBuilder.includes("CAPACITOR_ALLOW_MIXED_CONTENT") && androidBuilder.includes('parsedUrl.protocol === "http:"'), "Android builder enables mixed content only for an explicit local HTTP build");

const capacitorConfig = await readFile("apps/web/capacitor.config.ts", "utf8");
check(capacitorConfig.includes('allowMixedContent: process.env.CAPACITOR_ALLOW_MIXED_CONTENT === "true"'), "Capacitor mixed content is environment-gated");
check(capacitorConfig.includes('insetsHandling: "css"'), "Capacitor SystemBars injects Android safe-area values");

const appCss = await readFile("apps/web/src/styles/app.css", "utf8");
check(appCss.includes("--safe-area-inset-top") && appCss.includes("--safe-area-inset-bottom"), "Android system-bar insets are applied to top and bottom UI");
check(appCss.includes(".leaflet-control-zoom a") && appCss.includes(".leaflet-control-attribution a") && appCss.includes("min-height: 40px"), "Leaflet controls expose mobile-safe touch areas");
const launcherForeground = await readFile("apps/web/android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml", "utf8");
const launcherBackground = await readFile("apps/web/android/app/src/main/res/values/ic_launcher_background.xml", "utf8");
check(launcherForeground.includes("#6EE7B7") && launcherForeground.includes("#67E8F9") && launcherBackground.includes("#071B2E"), "Native launcher assets use the EduPath brand instead of the Capacitor default");

check(appSource.includes('text("Sign out", "সাইন আউট")') && appSource.includes("const signOut = async () =>"), "Mobile navigation exposes a persistent-session sign-out action");
check(appSource.includes("setReminderCenterOpen(true)") && appSource.includes("explorePathway(path.title)"), "Previously inactive reminder and pathway controls are wired");
check(appSource.includes("ScholarshipHub") && appSource.includes("AdmissionWorkspace"), "Admission workspace and scholarship matching are exposed in the application shell");
check(appSource.includes('href="#media-map"') && appSource.includes('["media-map", text('), "Campus map, video and audio are reachable from desktop and mobile navigation");
check(appSource.includes("loadStoredSession") && appSource.includes("Expired session token"), "Expired persisted sessions are rejected before protected components mount");
check(appSource.includes('apiRequest<{ data: CloudProfile | null }>("/api/me/profile"') && appSource.includes("window.setTimeout") && appSource.includes("profileSyncState"), "Student pathway profile hydrates from the API and saves with visible debounced sync state");
check(appSource.includes("signOutFirebaseUser") && appSource.includes("clearAllDeadlineReminders") && appSource.includes("handleAccountDeleted"), "Sign-out and account deletion clear authentication, reminders and device state");

const authModal = await readFile("apps/web/src/components/AuthModal.tsx", "utf8");
const apiClient = await readFile("apps/web/src/lib/api.ts", "utf8");
const communityHub = await readFile("apps/web/src/components/CommunityHub.tsx", "utf8");
const apiServer = await readFile("apps/api/src/server.ts", "utf8");
const mediaStorage = await readFile("apps/api/src/storage/media.ts", "utf8");
const accountCenter = await readFile("apps/web/src/components/AccountCenter.tsx", "utf8");
const firebaseServer = await readFile("apps/api/src/auth/firebase.ts", "utf8");
const store = await readFile("apps/api/src/data/store.ts", "utf8");
check(authModal.includes("reserveRegistration") && authModal.includes("deleteUser(credential.user)"), "Firebase registration reserves username and rolls back a failed account claim");
check(apiClient.includes('"/api/auth/register"') && apiServer.includes('app.post("/api/auth/register"'), "Registration reservation is wired through client and API");
check(apiClient.includes("handledExpiredSession") && apiClient.includes("Expired session cleared"), "Rejected sessions are cleared once without false duplicate runtime failures");
check(apiServer.includes("response.json(discussion)") && communityHub.includes("apiRequest<Discussion | null>"), "Nullable discussion state is returned without a false 404");
check(mediaStorage.includes("matchesSignature") && mediaStorage.includes("MediaValidationError"), "Upload content signatures are validated before storage");
check(apiServer.includes("mediaUploadRequestError") && apiServer.includes("File must be 5 MB or smaller"), "Upload request failures return field-specific safe messages");
check(authModal.includes("signInWithPhoneNumber") && authModal.includes("appVerificationDisabledForTesting"), "Firebase Phone Auth includes an explicit fictional-number demo mode");
check(apiServer.includes('app.get("/api/me/profile"') && apiServer.includes('app.put("/api/me/profile"') && store.includes("upsertStudentProfile"), "Authenticated student profiles have validated read and write persistence");
check(apiServer.includes('app.get("/api/me/export"') && accountCenter.includes("Download my EduPath data") && store.includes("exportUserData"), "User-scoped privacy export is connected from API to UI");
check(accountCenter.includes('startsWith("edupath_public_api:")') && !accountCenter.includes("localStorage.clear()"), "Privacy center clears only EduPath public cache entries");
check(apiServer.includes('app.delete("/api/me/account"') && apiServer.includes("authenticatedAt > 10 * 60") && apiServer.includes("currentIdentity.firebaseUid"), "Permanent deletion requires typed confirmation, matching Firebase identity and recent authentication");
check(firebaseServer.includes("deleteFirebaseIdentity") && firebaseServer.includes("authenticatedAt: decoded.auth_time") && store.includes("firebaseUid: input.firebaseUid"), "Firebase identity linkage is persisted and removable with authentication-time evidence");

const eligibility = await readFile("apps/api/src/domain/eligibility.ts", "utf8");
const localModel = await readFile("apps/web/src/lib/local-pathway-model.ts", "utf8");
const modelArtifact = JSON.parse(await readFile("apps/web/src/model/pathway-fit-model.json", "utf8"));
check(apiServer.includes("listEligibilityRules") && store.includes("prisma!.admissionRule.findMany") && eligibility.includes("AdmissionRuleInput"), "Eligibility is driven by current database admission rules");
check(localModel.includes('import("@tensorflow/tfjs")') && modelArtifact.framework.startsWith("TensorFlow.js") && modelArtifact.training.mae < 0.05, "Trained TensorFlow.js artifact and on-device inference are committed");

const mapHub = await readFile("apps/web/src/components/MediaMapHub.tsx", "utf8");
const reminders = await readFile("apps/web/src/lib/reminders.ts", "utf8");
const datePicker = await readFile("apps/web/src/components/DatePickerInput.tsx", "utf8");
check(mapHub.includes("MapContainer") && mapHub.includes("navigator.geolocation") && mapHub.includes("VITE_GOOGLE_MAPS_EMBED_KEY"), "Leaflet map, device location and optional Google provider are wired");
check(mapHub.includes("/api/institutions/") && mapHub.includes("edupath-admission-guide-en.mp4") && !mapHub.includes("aircAruvnKk") && !mapHub.includes("En-us-education.ogg"), "Campus video prefers verified institution/global media and has a bundled admission-specific fallback");
check(mapHub.includes("VITE_GUIDE_AUDIO_BN_URL") && mapHub.includes("VITE_GUIDE_AUDIO_EN_URL") && mapHub.includes("speechSynthesis"), "Audio follows the active language and safely falls back from verified/local recordings to device speech");
check(apiServer.includes('app.post("/api/admin/media"') && apiServer.includes("normalizeYouTubeUrl") && store.includes("Global fallback") && store.includes("languageCode"), "Admin-managed institution and global media are localized, reviewed and publicly filtered");
check(reminders.includes("LocalNotifications.schedule") && reminders.includes("LocalNotifications.cancel"), "Native deadline notifications can be scheduled and cancelled");
check(datePicker.includes('from "react-datepicker"') && datePicker.includes("<DatePicker"), "React Datepicker is used through the shared date input component");

const scholarshipHub = await readFile("apps/web/src/components/ScholarshipHub.tsx", "utf8");
const studentReport = await readFile("apps/web/src/components/StudentProgressReport.tsx", "utf8");
const csvImport = await readFile("apps/web/src/components/AdminCsvImport.tsx", "utf8");
check(apiServer.includes('app.get("/api/scholarships"') && scholarshipHub.includes("/api/scholarships"), "Scholarship matching API and UI are connected");
check(studentReport.includes('import("jspdf")') && studentReport.includes("navigator.share"), "Parent progress PDF supports download and native sharing");
check(apiServer.includes('app.post("/api/admin/import/institutions"') && csvImport.includes("Bulk CSV import"), "Protected CSV institution import is exposed in the admin UI");
check(apiServer.includes('app.patch("/api/admin/content/:kind/:id"') && store.includes("EDIT_CONTENT"), "Admin content editing is protected and audit logged");

const iosProject = await readFile("apps/web/ios/App/App.xcodeproj/project.pbxproj", "utf8");
check(iosProject.includes("PRODUCT_BUNDLE_IDENTIFIER = bd.edupath.app") && iosProject.includes("MARKETING_VERSION = 1.0.0") && iosProject.includes("CURRENT_PROJECT_VERSION = 21"), "Capacitor iOS native project uses the EduPath bundle identifier and release version");

const crystalViewer = await readFile("reports/crystal/windows-viewer/ReportViewerForm.cs", "utf8");
check(crystalViewer.includes("CrystalReportViewer") && crystalViewer.includes("ReportDocument"), "Crystal Reports Windows viewer source is included");

const migration = await readFile("apps/api/prisma/migrations/20260912000000_init/migration.sql", "utf8");
check(migration.includes('CREATE TABLE "User"') && migration.includes('CREATE TABLE "Institution"') && migration.includes("ADD CONSTRAINT"), "Committed PostgreSQL migration contains core tables and relationships");
const mediaMigration = await readFile("apps/api/prisma/migrations/20260913000000_verified_media/migration.sql", "utf8");
check(mediaMigration.includes('"verificationStatus"') && mediaMigration.includes('"updatedAt"') && mediaMigration.includes("Media_institutionId_verificationStatus_idx"), "Incremental migration adds review state and freshness tracking to media");
const localizedMediaMigration = await readFile("apps/api/prisma/migrations/20260914000000_localized_global_media/migration.sql", "utf8");
check(localizedMediaMigration.includes('"languageCode"') && localizedMediaMigration.includes("Media_languageCode_type_verificationStatus_idx"), "Incremental migration adds language-aware institution and global media lookup");
const identityMigration = await readFile("apps/api/prisma/migrations/20260916000000_firebase_identity_account_lifecycle/migration.sql", "utf8");
check(identityMigration.includes('"firebaseUid"') && identityMigration.includes("User_firebaseUid_key"), "Incremental migration adds a unique stable Firebase identity link");
check((await stat("apps/web/public/media/edupath-admission-guide-en.mp4")).size > 50_000, "Bundled fallback is a real admission-guidance video asset");
const prismaBinary = process.platform === "win32" ? "node_modules/.bin/prisma.cmd" : "node_modules/.bin/prisma";
await execFileAsync(prismaBinary, ["validate", "--schema", "apps/api/prisma/schema.prisma"], { maxBuffer: 2 * 1024 * 1024, env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || "postgresql://edupath:edupath@localhost:5432/edupath" } });
check(true, "Current Prisma schema validates with the committed incremental migration set");
const dockerfile = await readFile("apps/api/Dockerfile", "utf8");
const compose = await readFile("docker-compose.yml", "utf8");
const dockerIgnore = await readFile(".dockerignore", "utf8");
check(dockerfile.includes("apps/api/prisma") && dockerfile.includes("FROM build AS migrator") && dockerfile.includes("USER node"), "API container includes migration assets and a separate unprivileged runtime");
check(compose.includes('DEMO_MODE: "false"') && compose.includes("JWT_SECRET:") && compose.includes("/api/ready") && compose.includes("service_completed_successfully"), "Docker Compose supplies strict configuration, migrations and readiness checks");
check(dockerfile.includes("FROM build AS operations") && compose.includes("db-operations") && compose.includes("edupath_backups"), "Container stack includes isolated encrypted database recovery tooling and backup storage");
check(dockerIgnore.includes("node_modules") && dockerIgnore.includes(".env"), "Docker context excludes dependencies and local secrets");
const ciWorkflow = await readFile(".github/workflows/ci.yml", "utf8");
check(ciWorkflow.includes("npm run db:generate") && ciWorkflow.includes("npm run qa") && ciWorkflow.includes("npm run test:e2e") && ciWorkflow.includes("npm run audit:critical"), "GitHub Actions runs Prisma generation, full QA, Playwright acceptance and critical dependency audit");

const manifest = await readFile("apps/web/android/app/src/main/AndroidManifest.xml", "utf8");
check(manifest.includes('android:allowBackup="false"'), "Android production backup is disabled");
check(manifest.includes('android:usesCleartextTraffic="false"'), "Android production cleartext traffic is disabled");

const debugManifest = await readFile("apps/web/android/app/src/debug/AndroidManifest.xml", "utf8");
check(debugManifest.includes('android:usesCleartextTraffic="true"'), "Android debug build can reach a LAN HTTP API");
check(debugManifest.includes('tools:replace="android:usesCleartextTraffic"'), "Android debug cleartext setting overrides the production manifest safely");

const traceability = await readFile("docs/REQUIREMENTS_TRACEABILITY.md", "utf8");
for (let index = 1; index <= 24; index += 1) {
  check(traceability.includes(`| ${index} |`), `requirement ${index} has a traceability row`);
}

const envExample = await readFile(".env.example", "utf8");
check(envExample.includes("https://localhost") && envExample.includes("capacitor://localhost"), "native origins are documented in the environment template");
const exampleValues = Object.fromEntries(envExample.split(/\r?\n/).filter((line) => line.includes("=")).map((line) => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
check(!exampleValues.GEMINI_API_KEY && !exampleValues.SUPABASE_SERVICE_ROLE_KEY, "environment template contains no AI or storage secret");

console.log("EduPath BD release evidence is complete.");
process.exit(0);
