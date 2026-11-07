import assert from "node:assert/strict";
import fs from "node:fs";

const importer = fs.readFileSync(new URL("../../apps/api/scripts/import-pending-structured-promotions-7.ts", import.meta.url), "utf8");
assert.match(importer, /I_APPROVE_7_PENDING_STRUCTURED_PROMOTIONS/);
assert.match(importer, /VerificationStatus\.PENDING/);
assert.match(importer, /\$transaction/);
assert.match(importer, /programId:\s*null/);
assert.match(importer, /academicSession:\s*null/);
assert.doesNotMatch(importer, /VerificationStatus\.VERIFIED/);

const builder = fs.readFileSync(new URL("../../apps/api/scripts/build-structured-promotion-7.ts", import.meta.url), "utf8");
assert.match(builder, /Prime University/);
assert.match(builder, /indicativeDisplayedSlabs/);
assert.match(builder, /primeIndicativeSlabsTreatedAsConfirmedPolicy:\s*false/);
assert.match(builder, /scalarGpaFieldsInferred:\s*false/);

console.log("PASS structured promotion 7 safety test");
