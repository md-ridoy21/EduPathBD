import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { parseDatabaseUrl, verifyBackupManifest } from "./lib/database-operations.mjs";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", (error) => reject(new Error(`Could not start ${command}: ${error.message}`)));
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`)));
  });
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const backupFile = argument("--file");
if (!backupFile) throw new Error("Usage: npm run db:restore -- --file <backup.dump[.enc]> [--execute --confirm-db <database>]");
const resolvedBackup = path.resolve(backupFile);
await access(resolvedBackup);
const manifest = await verifyBackupManifest(resolvedBackup);
const connection = parseDatabaseUrl(process.env.DATABASE_URL);
const execute = process.argv.includes("--execute");
const confirmedDatabase = argument("--confirm-db");
const production = process.env.NODE_ENV === "production";

if (execute && confirmedDatabase !== connection.database) throw new Error(`Restore confirmation failed. Pass --confirm-db ${connection.database} exactly.`);
if (execute && production && process.env.RESTORE_APPROVED !== "true") throw new Error("Production restore requires RESTORE_APPROVED=true in addition to --execute and --confirm-db.");
if (manifest.database?.database && manifest.database.database !== connection.database) throw new Error(`Backup belongs to database ${manifest.database.database}, not ${connection.database}.`);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "edupath-restore-"));
const restoreSource = path.join(temporaryDirectory, "restore.dump");
try {
  if (manifest.encrypted) {
    const key = process.env.BACKUP_ENCRYPTION_KEY;
    if (!key) throw new Error("BACKUP_ENCRYPTION_KEY is required to decrypt this backup.");
    await run("openssl", ["enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", String(manifest.encryption?.iterations ?? 600000), "-in", resolvedBackup, "-out", restoreSource, "-pass", "env:BACKUP_ENCRYPTION_KEY"], { BACKUP_ENCRYPTION_KEY: key });
  }
  const source = manifest.encrypted ? restoreSource : resolvedBackup;
  await run("pg_restore", ["--list", source], connection.env);

  if (!execute) {
    console.log(JSON.stringify({ event: "database_restore_dry_run_complete", backup: resolvedBackup, target: { host: connection.env.PGHOST, port: connection.env.PGPORT, database: connection.database }, checksumVerified: true, encrypted: manifest.encrypted, nextStep: `Re-run with --execute --confirm-db ${connection.database}. Production also requires RESTORE_APPROVED=true.` }, null, 2));
  } else {
    await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", source], connection.env);
    console.log(JSON.stringify({ event: "database_restore_complete", backup: resolvedBackup, database: connection.database, restoredAt: new Date().toISOString() }, null, 2));
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
