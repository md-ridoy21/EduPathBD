import assert from "node:assert/strict";
import fs from "node:fs";

const importer=fs.readFileSync(new URL("../../apps/api/scripts/import-source-evidence-guarded.ts",import.meta.url),"utf8");
assert.match(importer,/I_APPROVE_1336_PENDING_SOURCE_EVIDENCE_IMPORT/);
assert.match(importer,/VerificationStatus\.PENDING/);
assert.match(importer,/structuredAdmissionRuleWrites:0/);
assert.match(importer,/structuredScholarshipWrites:0/);
assert.match(importer,/\$transaction/);
assert.doesNotMatch(importer,/VerificationStatus\.VERIFIED/);

const migration=fs.readFileSync(
  new URL("../../apps/api/prisma/migrations/20260925030000_admission_scholarship_evidence_foundation/migration.sql",import.meta.url),
  "utf8"
);
assert.match(migration,/CREATE TABLE IF NOT EXISTS "SourceEvidence"/);
assert.match(migration,/ALTER COLUMN "programId" DROP NOT NULL/);
assert.match(migration,/AdmissionRule_dataSourceId_sourceRecordId_key/);
assert.match(migration,/Scholarship_dataSourceId_sourceRecordId_key/);

console.log("PASS admission/scholarship evidence foundation safety test");
