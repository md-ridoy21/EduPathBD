import "dotenv/config";
import { EvidenceDataset, PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  const [
    totals,
    unresolvedParent,
    explicitNormalized,
    admissionGroups,
    scholarshipGroups,
  ] = await Promise.all([
    prisma.sourceEvidence.groupBy({
      by: ["dataset", "verificationStatus"],
      where: { dataSourceId: "source_ugc" },
      _count: { _all: true },
    }),
    prisma.sourceEvidence.count({
      where: {
        dataSourceId: "source_ugc",
        institutionId: null,
      },
    }),
    prisma.sourceEvidence.findMany({
      where: {
        dataSourceId: "source_ugc",
        normalizedValue: { not: null },
      },
      select: {
        id: true,
        dataset: true,
        institutionId: true,
        parentSourceRecordId: true,
        candidateType: true,
        sourceRecordId: true,
        sourceUrl: true,
        assistantAction: true,
        normalizedValue: true,
        normalizedSourceUrl: true,
        institution: { select: { name: true, verificationStatus: true } },
      },
      orderBy: [{ dataset: "asc" }, { parentSourceRecordId: "asc" }],
    }),
    prisma.sourceEvidence.groupBy({
      by: ["parentSourceRecordId", "sourceUrl"],
      where: {
        dataSourceId: "source_ugc",
        dataset: EvidenceDataset.ADMISSION,
        candidateType: "GPA_OR_ELIGIBILITY",
      },
      _count: { _all: true },
    }),
    prisma.sourceEvidence.groupBy({
      by: ["parentSourceRecordId", "sourceUrl"],
      where: {
        dataSourceId: "source_ugc",
        dataset: EvidenceDataset.SCHOLARSHIP,
      },
      _count: { _all: true },
    }),
  ]);

  const promotionCandidates = explicitNormalized.filter((row) => {
    if (row.dataset === EvidenceDataset.ADMISSION &&
        (row.assistantAction ?? "").toUpperCase().includes("FEE")) return false;
    return true;
  });

  console.log(JSON.stringify({
    status: "PASS_RECONSTRUCTION_READINESS_SNAPSHOT",
    mode: "READ_ONLY",
    dbWritesPerformed: false,
    totals,
    unresolvedParentEvidenceRows: unresolvedParent,
    normalizedEvidenceRows: explicitNormalized.length,
    promotionCandidateRows: promotionCandidates.length,
    admissionEligibilityGroups: admissionGroups.length,
    scholarshipPolicyGroups: scholarshipGroups.length,
    promotionCandidates,
    policy: {
      autoPromotionPerformed: false,
      verifiedPublicationPerformed: false,
      feeFragmentsPromotedToAdmissionRule: false,
      deadlineFragmentsPromotedToAdmissionRule: false,
    }
  }, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
