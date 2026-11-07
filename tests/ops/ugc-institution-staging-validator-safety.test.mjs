import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("UGC institution staging validator is read-only", async () => {
  const source = await readFile(
    new URL(
      "../../apps/api/scripts/validate-ugc-institution-staging.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /READ_ONLY_VALIDATION/);
  assert.match(source, /dbWritesPerformed:\s*false/);
  assert.match(source, /source_ugc/);
  assert.match(source, /sourceRecordId/);
  assert.match(source, /DRAFT/);
  assert.match(source, /production_verified/);

  assert.doesNotMatch(
    source,
    /prisma\.[A-Za-z0-9_]+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/
  );

  assert.doesNotMatch(source, /\$executeRaw/);
  assert.doesNotMatch(source, /\$queryRawUnsafe/);
});
