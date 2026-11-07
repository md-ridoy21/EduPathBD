-- Nationwide education catalog foundation. All new foreign keys are nullable so
-- existing production records remain deployable and can be linked by a verified import.
CREATE TYPE "OwnershipType" AS ENUM ('PUBLIC', 'PRIVATE', 'AUTONOMOUS', 'INTERNATIONAL', 'OTHER');
CREATE TYPE "PathwayCategory" AS ENUM ('GENERAL_SCHOOL', 'GENERAL_COLLEGE', 'POLYTECHNIC_DIPLOMA', 'TECHNICAL_VOCATIONAL', 'MEDICAL_TECHNOLOGY', 'NURSING_MIDWIFERY', 'UNIVERSITY_GENERAL', 'ENGINEERING', 'MEDICAL_DENTAL', 'PROFESSIONAL', 'SKILLS_TRAINING', 'HIGHER_STUDY');
CREATE TYPE "StudyScope" AS ENUM ('UPAZILA', 'DISTRICT', 'NATIONWIDE', 'INTERNATIONAL');
CREATE TYPE "DataAuthority" AS ENUM ('BANBEIS', 'DSHE', 'BTEB', 'UGC', 'DGME', 'BNMC', 'NATIONAL_UNIVERSITY', 'MINISTRY_OF_EDUCATION', 'INSTITUTION_OFFICIAL', 'OTHER_GOVERNMENT');
CREATE TYPE "ImportStatus" AS ENUM ('VALIDATING', 'REJECTED', 'COMMITTED', 'ROLLED_BACK');

CREATE TABLE "Division" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameBn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "District" (
  "id" TEXT NOT NULL,
  "divisionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameBn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Upazila" (
  "id" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameBn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Upazila_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataSource" (
  "id" TEXT NOT NULL,
  "authority" "DataAuthority" NOT NULL,
  "name" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "datasetUrl" TEXT,
  "license" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataImportRun" (
  "id" TEXT NOT NULL,
  "dataSourceId" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'VALIDATING',
  "fileName" TEXT NOT NULL,
  "fileSha256" TEXT NOT NULL,
  "recordsRead" INTEGER NOT NULL DEFAULT 0,
  "recordsAccepted" INTEGER NOT NULL DEFAULT 0,
  "recordsRejected" INTEGER NOT NULL DEFAULT 0,
  "validationLog" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DataImportRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudentProfile"
  ADD COLUMN "homeDistrictId" TEXT,
  ADD COLUMN "homeUpazilaId" TEXT,
  ADD COLUMN "preferredScope" "StudyScope" NOT NULL DEFAULT 'NATIONWIDE',
  ADD COLUMN "preferredPathways" "PathwayCategory"[] NOT NULL DEFAULT ARRAY[]::"PathwayCategory"[],
  ADD COLUMN "subjectResults" JSONB;

ALTER TABLE "Institution"
  ADD COLUMN "ownership" "OwnershipType",
  ADD COLUMN "officialCode" TEXT,
  ADD COLUMN "divisionId" TEXT,
  ADD COLUMN "districtId" TEXT,
  ADD COLUMN "upazilaId" TEXT,
  ADD COLUMN "dataSourceId" TEXT,
  ADD COLUMN "sourceRecordId" TEXT,
  ADD COLUMN "sourceUpdatedAt" TIMESTAMP(3);

ALTER TABLE "Program"
  ADD COLUMN "pathwayCategory" "PathwayCategory" NOT NULL DEFAULT 'UNIVERSITY_GENERAL',
  ADD COLUMN "entryStage" TEXT,
  ADD COLUMN "subjectAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "availableGroups" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "dataSourceId" TEXT,
  ADD COLUMN "sourceRecordId" TEXT;

CREATE UNIQUE INDEX "Division_code_key" ON "Division"("code");
CREATE UNIQUE INDEX "Division_slug_key" ON "Division"("slug");
CREATE UNIQUE INDEX "District_code_key" ON "District"("code");
CREATE UNIQUE INDEX "District_slug_key" ON "District"("slug");
CREATE INDEX "District_divisionId_name_idx" ON "District"("divisionId", "name");
CREATE UNIQUE INDEX "Upazila_code_key" ON "Upazila"("code");
CREATE UNIQUE INDEX "Upazila_districtId_slug_key" ON "Upazila"("districtId", "slug");
CREATE INDEX "Upazila_districtId_name_idx" ON "Upazila"("districtId", "name");
CREATE UNIQUE INDEX "DataSource_authority_baseUrl_key" ON "DataSource"("authority", "baseUrl");
CREATE INDEX "DataImportRun_dataSourceId_startedAt_idx" ON "DataImportRun"("dataSourceId", "startedAt");
CREATE INDEX "DataImportRun_status_idx" ON "DataImportRun"("status");
CREATE INDEX "StudentProfile_homeDistrictId_homeUpazilaId_idx" ON "StudentProfile"("homeDistrictId", "homeUpazilaId");
CREATE INDEX "Institution_districtId_upazilaId_type_idx" ON "Institution"("districtId", "upazilaId", "type");
CREATE INDEX "Institution_divisionId_type_idx" ON "Institution"("divisionId", "type");
CREATE UNIQUE INDEX "Institution_dataSourceId_sourceRecordId_key" ON "Institution"("dataSourceId", "sourceRecordId");
CREATE UNIQUE INDEX "Program_dataSourceId_sourceRecordId_key" ON "Program"("dataSourceId", "sourceRecordId");
CREATE INDEX "Program_pathwayCategory_entryStage_idx" ON "Program"("pathwayCategory", "entryStage");

ALTER TABLE "District" ADD CONSTRAINT "District_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Upazila" ADD CONSTRAINT "Upazila_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataImportRun" ADD CONSTRAINT "DataImportRun_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_homeDistrictId_fkey" FOREIGN KEY ("homeDistrictId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_homeUpazilaId_fkey" FOREIGN KEY ("homeUpazilaId") REFERENCES "Upazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_upazilaId_fkey" FOREIGN KEY ("upazilaId") REFERENCES "Upazila"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Program" ADD CONSTRAINT "Program_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
