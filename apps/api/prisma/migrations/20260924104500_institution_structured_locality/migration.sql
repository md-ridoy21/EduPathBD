CREATE TYPE "LocalityType" AS ENUM (
  'UPAZILA',
  'METRO_THANA',
  'CITY_AREA',
  'OTHER'
);

ALTER TABLE "Institution"
  ADD COLUMN "localityType" "LocalityType",
  ADD COLUMN "localityName" TEXT;

CREATE INDEX "Institution_localityType_localityName_idx"
  ON "Institution"("localityType", "localityName");
