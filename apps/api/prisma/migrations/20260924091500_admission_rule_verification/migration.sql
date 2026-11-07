ALTER TABLE "AdmissionRule"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE INDEX "AdmissionRule_verificationStatus_idx"
  ON "AdmissionRule"("verificationStatus");
