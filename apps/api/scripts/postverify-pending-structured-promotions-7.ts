import "dotenv/config";
import { PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

const admissionIds = [
  "ugc:admission:c0a3d4764ee81eb5dab5",
  "ugc:admission:b6a1be2c9002210a3ddc",
  "ugc:admission:9dc20b5db7bf99a63773",
  "ugc:admission:2cfcf6cf8f3b0b090869",
  "ugc:admission:393cf3a4505c9af03469",
];
const scholarshipIds = [
  "ugc:scholarship:88dd8e4036c73e68f9a5",
  "ugc:scholarship:d14a32d46a725c7e4601",
];

(async () => {
  const [a, s, av, sv, evidencePending, evidenceVerified] = await Promise.all([
    prisma.admissionRule.findMany({
      where: { dataSourceId: "source_ugc", sourceRecordId: { in: admissionIds } },
      select: { id: true, institutionId: true, sourceRecordId: true, verificationStatus: true, programId: true, academicSession: true, additionalCriteria: true, sourceUrl: true },
    }),
    prisma.scholarship.findMany({
      where: { dataSourceId: "source_ugc", sourceRecordId: { in: scholarshipIds } },
      select: { id: true, institutionId: true, sourceRecordId: true, verificationStatus: true, title: true, sourceUrl: true },
    }),
    prisma.admissionRule.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: admissionIds }, verificationStatus: VerificationStatus.VERIFIED } }),
    prisma.scholarship.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: scholarshipIds }, verificationStatus: VerificationStatus.VERIFIED } }),
    prisma.sourceEvidence.count({ where: { dataSourceId: "source_ugc", verificationStatus: VerificationStatus.PENDING } }),
    prisma.sourceEvidence.count({ where: { dataSourceId: "source_ugc", verificationStatus: VerificationStatus.VERIFIED } }),
  ]);

  const checks = {
    fiveAdmissionRules: a.length === 5,
    twoScholarships: s.length === 2,
    allAdmissionPending: a.every((x) => x.verificationStatus === "PENDING"),
    allScholarshipPending: s.every((x) => x.verificationStatus === "PENDING"),
    noAdmissionVerified: av === 0,
    noScholarshipVerified: sv === 0,
    noProgramScopeInferred: a.every((x) => x.programId === null),
    noAcademicSessionInferred: a.every((x) => x.academicSession === null),
    allAdmissionTextPresent: a.every((x) => !!x.additionalCriteria),
    evidenceStill1336Pending: evidencePending === 1336,
    evidenceStillZeroVerified: evidenceVerified === 0,
  };

  const hard = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);

  console.log(JSON.stringify({
    status: hard.length ? "HARD_STOP" : "PASS_PENDING_STRUCTURED_PROMOTION_7",
    mode: "READ_ONLY_POST_IMPORT_VERIFY",
    dbWritesPerformed: false,
    counts: {
      admissionRules: a.length,
      scholarships: s.length,
      evidencePending,
      evidenceVerified,
    },
    checks,
    hardStopReasons: hard,
    samples: { admissionRules: a, scholarships: s },
  }, null, 2));

  if (hard.length) process.exitCode = 2;
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
