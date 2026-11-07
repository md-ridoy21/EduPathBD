import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("corrected UGC parent importer is guarded", async () => {
  const source = await readFile(
    new URL(
      "../../apps/api/scripts/import-corrected-ugc-parents-guarded.ts",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /DRY_RUN_ONLY/);
  assert.match(source, /I_APPROVE_2_CORRECTED_UGC_PARENT_DRAFT_INSERTS/);
  assert.match(source, /if \(!apply\)/);
  assert.match(source, /approvalToken !== APPROVAL_TOKEN/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /VerificationStatus\.DRAFT/);

  assert.doesNotMatch(
    source,
    /VerificationStatus\.VERIFIED/
  );
});
