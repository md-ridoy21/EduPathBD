ALTER TABLE "Media"
ADD COLUMN "languageCode" TEXT;

CREATE INDEX "Media_languageCode_type_verificationStatus_idx"
ON "Media"("languageCode", "type", "verificationStatus");
