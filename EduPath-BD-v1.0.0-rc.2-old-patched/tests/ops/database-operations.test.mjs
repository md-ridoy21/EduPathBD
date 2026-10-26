import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { backupBaseName, manifestPathFor, parseDatabaseUrl, pruneBackups, sha256File, verifyBackupManifest } from "../../scripts/lib/database-operations.mjs";

test("database URLs become libpq environment without leaking the password", () => {
  const result = parseDatabaseUrl("postgresql://edupath:p%40ss@db.example:5433/edupath?sslmode=require");
  assert.equal(result.database, "edupath");
  assert.deepEqual(result.env, { PGHOST: "db.example", PGPORT: "5433", PGUSER: "edupath", PGPASSWORD: "p@ss", PGDATABASE: "edupath", PGSSLMODE: "require" });
  assert.ok(!JSON.stringify({ database: result.database, safeLabel: result.safeLabel }).includes("p@ss"));
});

test("backup names are deterministic and filesystem-safe", () => {
  assert.equal(backupBaseName("edupath", new Date("2026-09-16T12:34:56.789Z")), "edupath-postgres-edupath-2026-09-16T12-34-56-789Z");
});

test("manifest verification detects intact and corrupted backup files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edupath-backup-test-"));
  const backup = path.join(directory, `${backupBaseName("test", new Date("2026-09-16T00:00:00Z"))}.dump`);
  await writeFile(backup, "valid backup bytes");
  const sha256 = await sha256File(backup);
  await writeFile(manifestPathFor(backup), JSON.stringify({ format: "postgres-custom", sizeBytes: 18, sha256 }));
  assert.equal((await verifyBackupManifest(backup)).sha256, sha256);
  await writeFile(backup, "corrupted");
  await assert.rejects(verifyBackupManifest(backup), /checksum mismatch/i);
});

test("retention removes only recognized old backup pairs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "edupath-retention-test-"));
  for (const stamp of ["01", "02", "03"]) {
    const file = path.join(directory, `edupath-postgres-edupath-${stamp}.dump`);
    await writeFile(file, stamp);
    await writeFile(manifestPathFor(file), "{}");
  }
  await writeFile(path.join(directory, "do-not-delete.txt"), "safe");
  assert.deepEqual(await pruneBackups(directory, 2), ["edupath-postgres-edupath-01.dump"]);
  assert.equal(await readFile(path.join(directory, "do-not-delete.txt"), "utf8"), "safe");
});
