import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(
  new URL(
    "../../apps/api/scripts/validate-ugc-program-staging.ts",
    import.meta.url
  ),
  "utf8"
);

test(
  "UGC program staging validator is read-only",
  () => {
    assert.match(
      script,
      /mode:\s*"READ_ONLY_VALIDATION"/
    );

    assert.match(
      script,
      /dbWritesPerformed:\s*false/
    );

    assert.match(
      script,
      /id:\s*"source_ugc"/
    );

    assert.match(
      script,
      /sourceRecordId/
    );

    assert.match(
      script,
      /verification_status:\s*z\.literal\("DRAFT"\)/
    );

    assert.match(
      script,
      /production_verified:\s*z\.literal\("NO"\)/
    );

    assert.match(
      script,
      /parentsWithoutLocation/
    );

    assert.doesNotMatch(
      script,
      /prisma\.[A-Za-z0-9_]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/
    );

    assert.doesNotMatch(
      script,
      /\$executeRaw/
    );
  }
);
