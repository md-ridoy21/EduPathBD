import { readFile } from "node:fs/promises";

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

const [rootPackage, apiPackage, compose, dockerfile, config, server, apiClient, vite, productionEnv, backupScript, restoreScript, integrityScript, recoveryGuide] = await Promise.all([
  readFile("package.json", "utf8").then(JSON.parse),
  readFile("apps/api/package.json", "utf8").then(JSON.parse),
  readFile("docker-compose.yml", "utf8"),
  readFile("apps/api/Dockerfile", "utf8"),
  readFile("apps/api/src/config.ts", "utf8"),
  readFile("apps/api/src/server.ts", "utf8"),
  readFile("apps/web/src/lib/api.ts", "utf8"),
  readFile("apps/web/vite.config.ts", "utf8"),
  readFile(".env.production.example", "utf8"),
  readFile("scripts/database-backup.mjs", "utf8"),
  readFile("scripts/database-restore.mjs", "utf8"),
  readFile("scripts/database-integrity.mjs", "utf8"),
  readFile("docs/DATABASE_RECOVERY.md", "utf8")
]);

check(rootPackage.version === "1.0.0-rc.2" && apiPackage.version === rootPackage.version, "release-candidate versions are aligned");
check(config.includes("DEMO_MODE must be false") && config.includes("DATABASE_URL is required") && config.includes("JWT_SECRET must be at least 32"), "production configuration fails closed without core security settings");
check(config.includes("Production WEB_ORIGINS must use HTTPS") && config.includes("SUPABASE_SERVICE_ROLE_KEY is required"), "production origins and storage credentials are validated");
check(server.includes('app.get("/api/ready"') && server.includes("checkDataStoreReady") && server.includes("async function shutdown") && server.includes('process.once("SIGTERM"'), "API exposes readiness and graceful shutdown behavior");
check(dockerfile.includes("FROM build AS migrator") && dockerfile.includes("npm prune --omit=dev") && dockerfile.includes("USER node"), "API image separates migrations, prunes development dependencies and runs unprivileged");
check(!compose.includes("postgres:postgres") && !compose.includes("local-docker-secret") && compose.includes("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?") && compose.includes("JWT_SECRET: ${JWT_SECRET:?"), "Docker deployment has no known default database or JWT secret");
check(!compose.includes('"5432:5432"') && compose.includes("condition: service_completed_successfully") && compose.includes("/api/ready"), "database stays private and API waits for successful migrations/readiness");
check(compose.includes("read_only: true") && compose.includes("no-new-privileges:true") && compose.includes("cap_drop:"), "runtime container applies least-privilege controls");
check(apiPackage.scripts["start:production"] === "node dist/server.js" && !apiPackage.scripts["start:production"].includes("seed"), "production startup never mutates seed data");
check(apiPackage.scripts["db:migrate:deploy"] === "prisma migrate deploy", "schema migration is an explicit deployment stage");
check(apiClient.includes('VITE_API_URL || ""') && vite.includes("preview:") && vite.includes("/socket.io"), "web deployment defaults to same-origin API with local preview proxies");
check(vite.includes("codeSplitting") && vite.includes("vendor-tensorflow-core") && vite.includes("vendor-jspdf"), "large frontend libraries have explicit bundle groups");
check(productionEnv.includes("GENERATE_A_LONG_RANDOM_PASSWORD") && productionEnv.includes("https://app.example.com") && !productionEnv.includes("postgres:postgres"), "production environment template contains placeholders, not usable secrets");
check(rootPackage.scripts.qa.includes("verify:production"), "production verification is part of the standard QA gate");
check(rootPackage.scripts["db:backup"] && rootPackage.scripts["db:restore"] && rootPackage.scripts["db:integrity"], "database backup, restore and integrity commands are registered");
check(rootPackage.scripts["admin:bootstrap"] && rootPackage.scripts["production:integrations-check"] && rootPackage.scripts["production:runtime-check"], "audited admin bootstrap and live deployment verification commands are registered");
check(server.includes('app.delete("/api/me/account"') && server.includes("authenticatedAt > 10 * 60") && server.includes("currentIdentity.firebaseUid"), "production account deletion requires recent matching Firebase authentication");
check(backupScript.includes("BACKUP_ENCRYPTION_KEY") && backupScript.includes("sha256File") && backupScript.includes("pruneBackups"), "backups require production encryption and publish checksum/retention evidence");
check(restoreScript.includes("database_restore_dry_run_complete") && restoreScript.includes("--confirm-db") && restoreScript.includes("RESTORE_APPROVED"), "restore defaults to verification and requires explicit production approval");
check(integrityScript.includes("rating-score-range") && integrityScript.includes("verified-institution-source") && integrityScript.includes("duplicate-casefolded-emails"), "database integrity checks cover domain ranges, verified sources and account uniqueness");
check(dockerfile.includes("FROM build AS operations") && compose.includes('profiles: ["operations"]') && compose.includes("edupath_backups"), "containerized database operations use a persistent backup volume");
check(productionEnv.includes("BACKUP_ENCRYPTION_KEY") && recoveryGuide.includes("Restore drill") && recoveryGuide.includes("Release rollback order"), "production secrets template and recovery runbook cover backup and rollback operations");

console.log("EduPath BD production hardening checks passed.");
