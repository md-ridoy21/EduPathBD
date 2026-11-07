ALTER TABLE "Media"
ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Media_institutionId_verificationStatus_idx"
ON "Media"("institutionId", "verificationStatus");
