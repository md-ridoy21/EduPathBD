import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("guarded UGC institution importer requires explicit apply and approval", async () => {
  const source = await readFile(
    new URL(
      "../../apps/api/scripts/import-ugc-institutions-guarded.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /DRY_RUN_ONLY/);
  assert.match(source, /I_APPROVE_108_DRAFT_AND_2_LINEAGE_BACKFILLS/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /approvalToken !== APPROVAL_TOKEN/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /VerificationStatus\.DRAFT/);
  assert.match(source, /VerificationStatus\.VERIFIED/);

  assert.match(
    source,
    /data:\s*\{\s*sourceRecordId:\s*"ugc:public:1"\s*\}/
  );

  assert.match(
    source,
    /data:\s*\{\s*sourceRecordId:\s*"ugc:public:5"\s*\}/
  );
});
