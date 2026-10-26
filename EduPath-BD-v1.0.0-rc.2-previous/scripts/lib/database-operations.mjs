import { createHash } from "node:crypto";
import { readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export const backupPrefix = "edupath-postgres-";

export function parseDatabaseUrl(value) {
  if (!value) throw new Error("DATABASE_URL is required.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must use postgres:// or postgresql://.");
  if (!url.hostname || !url.username || !url.pathname.slice(1)) throw new Error("DATABASE_URL must include host, user and database name.");

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_.-]+$/.test(database)) throw new Error("Database name contains unsupported characters.");
  return {
    database,
    safeLabel: database.replace(/[^A-Za-z0-9_.-]/g, "_"),
    env: {
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: database,
      ...(url.searchParams.get("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode") } : {})
    }
  };
}

export function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function backupBaseName(database, date = new Date()) {
  return `${backupPrefix}${database}-${timestampForFilename(date)}`;
}

export async function sha256File(file) {
  const bytes = await readFile(file);
  return createHash("sha256").update(bytes).digest("hex");
}

export function manifestPathFor(backupFile) {
  return `${backupFile}.json`;
}

export async function verifyBackupManifest(backupFile) {
  const manifestFile = manifestPathFor(backupFile);
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const actual = await sha256File(backupFile);
  if (manifest.sha256 !== actual) throw new Error(`Backup checksum mismatch. Expected ${manifest.sha256}, received ${actual}.`);
  const details = await stat(backupFile);
  if (manifest.sizeBytes !== details.size) throw new Error(`Backup size mismatch. Expected ${manifest.sizeBytes}, received ${details.size}.`);
  if (manifest.format !== "postgres-custom") throw new Error(`Unsupported backup format: ${manifest.format}`);
  return manifest;
}

export async function pruneBackups(directory, keepCount) {
  if (!Number.isInteger(keepCount) || keepCount < 1 || keepCount > 365) throw new Error("BACKUP_RETENTION_COUNT must be between 1 and 365.");
  const names = (await readdir(directory)).filter((name) => name.startsWith(backupPrefix) && (name.endsWith(".dump") || name.endsWith(".dump.enc"))).sort().reverse();
  const deleted = [];
  for (const name of names.slice(keepCount)) {
    const backupFile = path.join(directory, name);
    await rm(backupFile, { force: true });
    await rm(manifestPathFor(backupFile), { force: true });
    deleted.push(name);
  }
  return deleted;
}

export function publicDatabaseIdentity(connection) {
  return { host: connection.env.PGHOST, port: connection.env.PGPORT, database: connection.database, user: connection.env.PGUSER };
}
