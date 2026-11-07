-- EduPath BD: admission/scholarship provenance foundation
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
