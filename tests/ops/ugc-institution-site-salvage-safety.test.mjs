import assert from "node:assert/strict";
import fs from "node:fs";

const salvage = fs.readFileSync(
  new URL("../../apps/api/scripts/salvage-ugc-programs-from-institution-sites.ts", import.meta.url),
  "utf8"
);
assert.match(salvage, /HOST_INSTITUTION_IDENTITY_NOT_STRONG/);
assert.match(salvage, /PROGRAM_EVIDENCE_NOT_STRONG_ON_SOURCE_PAGE/);
assert.match(salvage, /strict_semantic_status/);
assert.match(salvage, /PASS_STRONG/);
assert.match(salvage, /verifiedPublicationAllowed:\s*false/);
assert.match(salvage, /fakeOrInferredProgramCreationAllowed:\s*false/);

const importer = fs.readFileSync(
  new URL("../../apps/api/scripts/import-ugc-programs-guarded.ts", import.meta.url),
  "utf8"
);
assert.match(importer, /PASS_STRONG/);
assert.match(importer, /VerificationStatus\.DRAFT/);
assert.match(importer, /\$transaction/);
assert.doesNotMatch(importer, /verificationStatus:\s*VerificationStatus\.VERIFIED/);

console.log("PASS institution-site salvage + guarded importer safety test");
