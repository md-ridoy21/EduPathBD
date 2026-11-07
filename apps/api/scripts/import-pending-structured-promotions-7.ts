import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Prisma, PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();
const TOKEN = "I_APPROVE_7_PENDING_STRUCTURED_PROMOTIONS";

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string) {
  return process.argv.includes(flag);
}

type Payload = {
  status: string;
  admissionRules: any[];
  scholarships: any[];
};

(async () => {
  const file = arg("--file");
  const apply = has("--apply");
  const token = arg("--approval-token") ?? "";
  if (!file) throw new Error("HARD_STOP: --file is required");
  if (apply && token !== TOKEN) throw new Error("HARD_STOP: invalid approval token");

  const payload = JSON.parse(await readFile(resolve(file), "utf8")) as Payload;
  if (payload.status !== "PASS_STRUCTURED_PROMOTION_STAGING_7") {
    throw new Error("HARD_STOP: staging status is not PASS");
  }
  if (payload.admissionRules.length !== 5 || payload.scholarships.length !== 2) {
    throw new Error("HARD_STOP: expected 5 admission + 2 scholarship rows");
  }

  const all = [...payload.admissionRules, ...payload.scholarships];
  if (all.some((r) => r.verificationStatus !== "PENDING")) {
    throw new Error("HARD_STOP: non-PENDING promotion row");
  }
  if (payload.admissionRules.some((r) => r.programId !== null || r.academicSession !== null)) {
    throw new Error("HARD_STOP: program/session inference detected");
  }
  if (payload.admissionRules.some((r) =>
    r.minimumSscGpa !== null ||
    r.minimumHscGpa !== null ||
    r.minimumCombinedGpa !== null
  )) {
    throw new Error("HARD_STOP: scalar GPA inference detected");
  }

  const ids = all.map((r) => r.sourceRecordId);
  if (new Set(ids).size !== 7) throw new Error("HARD_STOP: duplicate promotion sourceRecordId");

  const [existingAdmissions, existingScholarships] = await Promise.all([
    prisma.admissionRule.findMany({
      where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.admissionRules.map((r) => r.sourceRecordId) } },
      select: { id: true, sourceRecordId: true },
    }),
    prisma.scholarship.findMany({
      where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.scholarships.map((r) => r.sourceRecordId) } },
      select: { id: true, sourceRecordId: true },
    }),
  ]);

  const evidenceIds = all.map((r) => r.sourceEvidenceId);
  const evidence = await prisma.sourceEvidence.findMany({
    where: {
      id: { in: evidenceIds },
      dataSourceId: "source_ugc",
      verificationStatus: VerificationStatus.PENDING,
    },
    select: { id: true, institutionId: true, normalizedValue: true, normalizedSourceUrl: true },
  });
  const evMap = new Map(evidence.map((e) => [e.id, e]));

  const hard: string[] = [];
  if (existingAdmissions.length) hard.push("EXISTING_ADMISSION_PROMOTION_COLLISION");
  if (existingScholarships.length) hard.push("EXISTING_SCHOLARSHIP_PROMOTION_COLLISION");
  if (evidence.length !== 7) hard.push("NOT_ALL_SOURCE_EVIDENCE_ROWS_AVAILABLE_PENDING");

  for (const r of all) {
    const e = evMap.get(r.sourceEvidenceId);
    if (!e) continue;
    if (e.institutionId !== r.institutionId) hard.push(`INSTITUTION_MISMATCH:${r.sourceRecordId}`);
    if (e.normalizedValue !== r.description && r.additionalCriteria !== e.normalizedValue) {
      hard.push(`NORMALIZED_VALUE_MISMATCH:${r.sourceRecordId}`);
    }
    if (e.normalizedSourceUrl !== r.sourceUrl) hard.push(`SOURCE_URL_MISMATCH:${r.sourceRecordId}`);
  }

  const preflight = {
    status: hard.length ? "HARD_STOP" : (apply ? "READY_TO_APPLY" : "DRY_RUN_READY_FOR_EXPLICIT_HUMAN_APPROVAL"),
    mode: apply ? "EXPLICIT_HUMAN_APPROVED_TRANSACTION" : "DRY_RUN_ONLY",
    dbWritesPerformed: false,
    admissionRules: payload.admissionRules.length,
    scholarships: payload.scholarships.length,
    sourceEvidenceRowsValidated: evidence.length,
    verificationStatus: "PENDING",
    verifiedPublicationPerformed: false,
    hardStopReasons: hard,
    requiredApprovalToken: TOKEN,
  };

  if (hard.length || !apply) {
    console.log(JSON.stringify(preflight, null, 2));
    if (hard.length) process.exitCode = 2;
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const a = await tx.admissionRule.createMany({
      data: payload.admissionRules.map((r) => ({
        institutionId: r.institutionId,
        programId: null,
        dataSourceId: "source_ugc",
        sourceRecordId: r.sourceRecordId,
        sourceCandidateIds: r.sourceCandidateIds,
        sourceEvidence: r.sourceEvidence as Prisma.InputJsonValue,
        academicSession: null,
        applicantStage: null,
        allowedGroups: [],
        minimumSscGpa: null,
        minimumHscGpa: null,
        minimumCombinedGpa: null,
        requiredSubjects: Prisma.JsonNull,
        minimumSubjectGrades: Prisma.JsonNull,
        additionalCriteria: r.additionalCriteria,
        sourceUrl: r.sourceUrl,
        effectiveFrom: null,
        effectiveUntil: null,
        verificationStatus: VerificationStatus.PENDING,
        verifiedAt: null,
      })),
    });

    const s = await tx.scholarship.createMany({
      data: payload.scholarships.map((r) => ({
        institutionId: r.institutionId,
        programId: null,
        dataSourceId: "source_ugc",
        sourceRecordId: r.sourceRecordId,
        sourceCandidateIds: r.sourceCandidateIds,
        sourceEvidence: r.sourceEvidence as Prisma.InputJsonValue,
        title: r.title,
        provider: r.provider,
        description: r.description,
        eligibility: r.eligibility as Prisma.InputJsonValue,
        amountDescription: r.amountDescription,
        deadline: null,
        sourceUrl: r.sourceUrl,
        verificationStatus: VerificationStatus.PENDING,
      })),
    });

    if (a.count !== 5 || s.count !== 2) {
      throw new Error(`HARD_STOP_IN_TRANSACTION: created admission=${a.count}, scholarship=${s.count}`);
    }

    const [pendingA, pendingS, verifiedA, verifiedS] = await Promise.all([
      tx.admissionRule.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.admissionRules.map((r) => r.sourceRecordId) }, verificationStatus: "PENDING" } }),
      tx.scholarship.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.scholarships.map((r) => r.sourceRecordId) }, verificationStatus: "PENDING" } }),
      tx.admissionRule.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.admissionRules.map((r) => r.sourceRecordId) }, verificationStatus: "VERIFIED" } }),
      tx.scholarship.count({ where: { dataSourceId: "source_ugc", sourceRecordId: { in: payload.scholarships.map((r) => r.sourceRecordId) }, verificationStatus: "VERIFIED" } }),
    ]);

    if (pendingA !== 5 || pendingS !== 2 || verifiedA !== 0 || verifiedS !== 0) {
      throw new Error("HARD_STOP_IN_TRANSACTION: post-create verification mismatch");
    }

    return {
      insertedPendingAdmissionRules: a.count,
      insertedPendingScholarships: s.count,
      verifiedAdmissionRules: verifiedA,
      verifiedScholarships: verifiedS,
    };
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify({
    status: "APPLY_SUCCESS",
    mode: "EXPLICIT_HUMAN_APPROVED_TRANSACTION",
    dbWritesPerformed: true,
    result,
    sourceEvidenceStatusChanged: false,
    verifiedPublicationPerformed: false,
  }, null, 2));
})()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
