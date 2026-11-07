import assert from "node:assert/strict";
import fs from "node:fs";

const p = new URL("../../apps/api/scripts/import-ugc-programs-guarded.ts", import.meta.url);
const s = fs.readFileSync(p, "utf8");

assert.match(s, /I_APPROVE_STRICT_VERIFIED_UGC_PROGRAM_DRAFT_IMPORT/);
assert.match(s, /source_verification_status/);
assert.match(s, /PASS_STRONG/);
assert.match(s, /strict_semantic_status/);
assert.match(s, /VerificationStatus\.DRAFT/);
assert.match(s, /\$transaction/);
assert.match(s, /verifiedPublicationAllowed:\s*false/);
assert.doesNotMatch(s, /verificationStatus:\s*VerificationStatus\.VERIFIED/);

console.log("PASS guarded UGC Program importer safety test");
