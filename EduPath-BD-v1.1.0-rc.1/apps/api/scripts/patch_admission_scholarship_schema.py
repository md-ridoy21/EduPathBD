#!/usr/bin/env python3
import re
import sys
from pathlib import Path

if len(sys.argv) != 2:
    print("Usage: python3 patch_admission_scholarship_schema.py <api-root>")
    raise SystemExit(2)

api = Path(sys.argv[1]).expanduser().resolve()
schema_path = api / "prisma/schema.prisma"
schema = schema_path.read_text(encoding="utf-8")

MARKER = "// EDUPATH_ADMISSION_SCHOLARSHIP_EVIDENCE_V1"

def get_block(text, name):
    m = re.search(rf"(?ms)^model\s+{re.escape(name)}\s*\{{.*?^\}}", text)
    if not m:
        raise SystemExit(f"HARD_STOP: model {name} not found")
    return m.group(0), m.start(), m.end()

def replace_block(text, name, new_block):
    _, start, end = get_block(text, name)
    return text[:start] + new_block + text[end:]

if MARKER not in schema:
    ad_old, _, _ = get_block(schema, "AdmissionRule")
    sch_old, _, _ = get_block(schema, "Scholarship")

    if "institutionId" in ad_old or "sourceRecordId" in ad_old:
        raise SystemExit("HARD_STOP: AdmissionRule already contains unexpected V1-style fields; inspect manually")

    ad_new = '''model AdmissionRule {
  id                   String             @id @default(cuid())
  institutionId        String?
  programId            String?
  dataSourceId         String?
  sourceRecordId       String?
  sourceCandidateIds   String[]           @default([])
  sourceEvidence       Json?
  academicSession      String?
  applicantStage       String?
  allowedGroups        String[]           @default([])
  minimumSscGpa        Decimal?           @db.Decimal(3, 2)
  minimumHscGpa        Decimal?           @db.Decimal(3, 2)
  minimumCombinedGpa   Decimal?           @db.Decimal(4, 2)
  requiredSubjects     Json?
  minimumSubjectGrades Json?
  additionalCriteria   String?
  sourceUrl            String
  effectiveFrom        DateTime?
  effectiveUntil       DateTime?
  verificationStatus   VerificationStatus @default(PENDING)
  verifiedAt           DateTime?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  institution          Institution?       @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  program              Program?           @relation(fields: [programId], references: [id], onDelete: Cascade)
  dataSource           DataSource?        @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)

  @@unique([dataSourceId, sourceRecordId])
  @@index([institutionId])
  @@index([programId, academicSession])
  @@index([academicSession])
  @@index([verificationStatus])
}'''

    if "dataSourceId" in sch_old or "sourceRecordId" in sch_old:
        raise SystemExit("HARD_STOP: Scholarship already contains unexpected V1-style lineage fields; inspect manually")

    sch_new = sch_old
    sch_new = sch_new.replace(
        "  programId          String?\n",
        "  programId          String?\n"
        "  dataSourceId       String?\n"
        "  sourceRecordId     String?\n"
        "  sourceCandidateIds String[]           @default([])\n"
        "  sourceEvidence     Json?\n"
    )

    relation_anchor = "  program            Program?           @relation(fields: [programId], references: [id], onDelete: SetNull)\n"
    if relation_anchor not in sch_new:
        raise SystemExit("HARD_STOP: Scholarship program relation anchor not found")

    sch_new = sch_new.replace(
        relation_anchor,
        relation_anchor +
        "  dataSource         DataSource?        @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)\n"
    )

    if "  @@index([deadline])\n" not in sch_new:
        raise SystemExit("HARD_STOP: Scholarship deadline index anchor not found")

    sch_new = sch_new.replace(
        "  @@index([deadline])\n",
        "  @@unique([dataSourceId, sourceRecordId])\n"
        "  @@index([deadline])\n"
        "  @@index([verificationStatus])\n"
    )

    schema = replace_block(schema, "AdmissionRule", ad_new)
    schema = replace_block(schema, "Scholarship", sch_new)

    def add_field_to_model(text, model, field_line, presence_token):
        block, _, _ = get_block(text, model)
        if presence_token in block:
            return text
        insert_pos = block.rfind("}")
        new_block = block[:insert_pos] + field_line + "\n" + block[insert_pos:]
        return replace_block(text, model, new_block)

    schema = add_field_to_model(schema, "Institution", "  admissionRules      AdmissionRule[]", "AdmissionRule[]")
    schema = add_field_to_model(schema, "Institution", "  sourceEvidence      SourceEvidence[]", "SourceEvidence[]")
    schema = add_field_to_model(schema, "Program", "  sourceEvidence      SourceEvidence[]", "SourceEvidence[]")
    schema = add_field_to_model(schema, "DataSource", "  admissionRules      AdmissionRule[]", "AdmissionRule[]")
    schema = add_field_to_model(schema, "DataSource", "  scholarships        Scholarship[]", "Scholarship[]")
    schema = add_field_to_model(schema, "DataSource", "  sourceEvidence      SourceEvidence[]", "SourceEvidence[]")

    if "enum EvidenceDataset" not in schema:
        schema += '''

enum EvidenceDataset {
  ADMISSION
  SCHOLARSHIP
}
'''

    if "model SourceEvidence" not in schema:
        schema += '''

model SourceEvidence {
  id                   String             @id @default(cuid())
  dataset              EvidenceDataset
  institutionId        String?
  programId            String?
  dataSourceId         String?
  sourceRecordId       String?
  parentSourceRecordId String?
  candidateType        String?
  sourceCandidateText  String
  sourceUrl            String
  pageSha256Values     String[]           @default([])
  extractedValues      Json?
  assistantDecision    String?
  assistantAction      String?
  normalizedValue      String?
  normalizedSourceUrl  String?
  verificationStatus   VerificationStatus @default(PENDING)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  institution          Institution?       @relation(fields: [institutionId], references: [id], onDelete: SetNull)
  program              Program?           @relation(fields: [programId], references: [id], onDelete: SetNull)
  dataSource           DataSource?        @relation(fields: [dataSourceId], references: [id], onDelete: SetNull)

  @@unique([dataSourceId, sourceRecordId])
  @@index([dataset, verificationStatus])
  @@index([institutionId, dataset])
  @@index([parentSourceRecordId])
}
'''

    schema = schema.rstrip() + "\n\n" + MARKER + "\n"
    schema_path.write_text(schema, encoding="utf-8")
    print("SCHEMA_PATCH_APPLIED")
else:
    print("SCHEMA_ALREADY_PATCHED")

migration_dir = api / "prisma/migrations/20260925030000_admission_scholarship_evidence_foundation"
migration_dir.mkdir(parents=True, exist_ok=True)
sql_path = migration_dir / "migration.sql"

sql = '''-- EduPath BD: admission/scholarship provenance foundation
-- Existing AdmissionRule and Scholarship tables were confirmed empty.

DO $$
BEGIN
  CREATE TYPE "EvidenceDataset" AS ENUM ('ADMISSION', 'SCHOLARSHIP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "AdmissionRule"
  ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
  ADD COLUMN IF NOT EXISTS "dataSourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRecordId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCandidateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "sourceEvidence" JSONB;

ALTER TABLE "AdmissionRule"
  ALTER COLUMN "programId" DROP NOT NULL,
  ALTER COLUMN "academicSession" DROP NOT NULL,
  ALTER COLUMN "applicantStage" DROP NOT NULL,
  ALTER COLUMN "allowedGroups" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Scholarship"
  ADD COLUMN IF NOT EXISTS "dataSourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceRecordId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCandidateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "sourceEvidence" JSONB;

DROP INDEX IF EXISTS "AdmissionRule_programId_academicSession_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AdmissionRule_dataSourceId_sourceRecordId_key"
  ON "AdmissionRule"("dataSourceId", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "AdmissionRule_institutionId_idx"
  ON "AdmissionRule"("institutionId");

CREATE INDEX IF NOT EXISTS "AdmissionRule_programId_academicSession_idx"
  ON "AdmissionRule"("programId", "academicSession");

CREATE UNIQUE INDEX IF NOT EXISTS "Scholarship_dataSourceId_sourceRecordId_key"
  ON "Scholarship"("dataSourceId", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "Scholarship_verificationStatus_idx"
  ON "Scholarship"("verificationStatus");

DO $$
BEGIN
  ALTER TABLE "AdmissionRule"
    ADD CONSTRAINT "AdmissionRule_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AdmissionRule"
    ADD CONSTRAINT "AdmissionRule_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Scholarship"
    ADD CONSTRAINT "Scholarship_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SourceEvidence" (
  "id" TEXT NOT NULL,
  "dataset" "EvidenceDataset" NOT NULL,
  "institutionId" TEXT,
  "programId" TEXT,
  "dataSourceId" TEXT,
  "sourceRecordId" TEXT,
  "parentSourceRecordId" TEXT,
  "candidateType" TEXT,
  "sourceCandidateText" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "pageSha256Values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "extractedValues" JSONB,
  "assistantDecision" TEXT,
  "assistantAction" TEXT,
  "normalizedValue" TEXT,
  "normalizedSourceUrl" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceEvidence_dataSourceId_sourceRecordId_key"
  ON "SourceEvidence"("dataSourceId", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "SourceEvidence_dataset_verificationStatus_idx"
  ON "SourceEvidence"("dataset", "verificationStatus");

CREATE INDEX IF NOT EXISTS "SourceEvidence_institutionId_dataset_idx"
  ON "SourceEvidence"("institutionId", "dataset");

CREATE INDEX IF NOT EXISTS "SourceEvidence_parentSourceRecordId_idx"
  ON "SourceEvidence"("parentSourceRecordId");

DO $$
BEGIN
  ALTER TABLE "SourceEvidence"
    ADD CONSTRAINT "SourceEvidence_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SourceEvidence"
    ADD CONSTRAINT "SourceEvidence_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "SourceEvidence"
    ADD CONSTRAINT "SourceEvidence_dataSourceId_fkey"
    FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
'''

if not sql_path.exists():
    sql_path.write_text(sql, encoding="utf-8")
    print(f"MIGRATION_CREATED {sql_path}")
else:
    existing = sql_path.read_text(encoding="utf-8")
    if existing != sql:
        raise SystemExit("HARD_STOP: migration file exists with different content")
    print("MIGRATION_ALREADY_PRESENT")
