import "./lib/load-api-env.mjs";
import { spawn } from "node:child_process";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  backupBaseName,
  manifestPathFor,
  parseDatabaseUrl,
  pruneBackups,
  publicDatabaseIdentity,
  sha256File
} from "./lib/database-operations.mjs";

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", (error) => reject(new Error(`Could not start ${command}: ${error.message}`)));
    child.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}.`)));
  });
}

function positiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const connection = parseDatabaseUrl(process.env.DATABASE_URL);
const directory = path.resolve(process.env.BACKUP_DIR || "backups/postgres");
const production = process.env.NODE_ENV === "production";
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
const allowUnencrypted = process.env.ALLOW_UNENCRYPTED_BACKUP === "true";
if (production && (!encryptionKey || encryptionKey.length < 32)) throw new Error("Production backups require BACKUP_ENCRYPTION_KEY with at least 32 characters.");
if (!encryptionKey && !allowUnencrypted) throw new Error("Set BACKUP_ENCRYPTION_KEY, or explicitly set ALLOW_UNENCRYPTED_BACKUP=true for a non-production local drill.");

const retentionCount = positiveInteger(process.env.BACKUP_RETENTION_COUNT, 14, "BACKUP_RETENTION_COUNT");
await mkdir(directory, { recursive: true, mode: 0o700 });

const base = backupBaseName(connection.safeLabel);
const rawTemporary = path.join(directory, `.${base}.${process.pid}.dump.tmp`);
const encryptedTemporary = `${rawTemporary}.enc`;
const finalFile = path.join(directory, `${base}.dump${encryptionKey ? ".enc" : ""}`);

try {
  await run("pg_dump", ["--format=custom", "--compress=9", "--no-owner", "--no-privileges", `--file=${rawTemporary}`], connection.env);
  if (encryptionKey) {
    await run("openssl", ["enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-iter", "600000", "-in", rawTemporary, "-out", encryptedTemporary, "-pass", "env:BACKUP_ENCRYPTION_KEY"], { BACKUP_ENCRYPTION_KEY: encryptionKey });
    await rm(rawTemporary, { force: true });
    await rename(encryptedTemporary, finalFile);
  } else {
    await rename(rawTemporary, finalFile);
  }

  const details = await stat(finalFile);
  const manifest = {
    schemaVersion: 1,
    application: "EduPath BD",
    applicationVersion: process.env.npm_package_version || "unknown",
    createdAt: new Date().toISOString(),
    database: publicDatabaseIdentity(connection),
    format: "postgres-custom",
    encrypted: Boolean(encryptionKey),
    encryption: encryptionKey ? { cipher: "aes-256-cbc", keyDerivation: "pbkdf2", iterations: 600000 } : null,
    file: path.basename(finalFile),
    sizeBytes: details.size,
    sha256: await sha256File(finalFile)
  };
  await writeFile(manifestPathFor(finalFile), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  const deleted = await pruneBackups(directory, retentionCount);
  console.log(JSON.stringify({ event: "database_backup_complete", backup: finalFile, manifest: manifestPathFor(finalFile), encrypted: manifest.encrypted, sizeBytes: manifest.sizeBytes, sha256: manifest.sha256, pruned: deleted }, null, 2));
} catch (error) {
  await Promise.all([rm(rawTemporary, { force: true }), rm(encryptedTemporary, { force: true })]);
  throw error;
}
