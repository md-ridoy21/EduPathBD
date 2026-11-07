import assert from "node:assert/strict";
import fs from "node:fs";

const s = fs.readFileSync(new URL("../../apps/api/scripts/ugc_portal_program_salvage.py", import.meta.url), "utf8");
assert.match(s, /ugc-universities\.gov\.bd/);
assert.match(s, /UGC_APPROVED_DEGREE_EXACT/);
assert.match(s, /UGC_APPROVED_DEGREE_STRONG_UNIQUE/);
assert.match(s, /verificationStatusForImport.*DRAFT/s);
assert.match(s, /verifiedPublicationAllowed.*False/s);
assert.match(s, /fakeOrInferredProgramCreationAllowed.*False/s);

const importer = fs.readFileSync(new URL("../../apps/api/scripts/import-ugc-programs-guarded.ts", import.meta.url), "utf8");
assert.match(importer, /PASS_STRONG/);
assert.match(importer, /strict_semantic_status/);
assert.match(importer, /VerificationStatus\.DRAFT/);
assert.doesNotMatch(importer, /verificationStatus:\s*VerificationStatus\.VERIFIED/);

console.log("PASS UGC authoritative salvage + guarded importer safety test");
