import "dotenv/config";
import { PrismaClient, EvidenceDataset } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const prisma = new PrismaClient();

const IDS = [
  "CAN:c0a3d4764ee81eb5dab5",
  "CAN:b6a1be2c9002210a3ddc",
  "CAN:9dc20b5db7bf99a63773",
  "CAN:2cfcf6cf8f3b0b090869",
  "CAN:393cf3a4505c9af03469",
  "CAN:88dd8e4036c73e68f9a5",
  "CAN:d14a32d46a725c7e4601",
] as const;

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

(async () => {
  const out = resolve(arg("--out") ?? "./structured-promotion-7.json");

  const rows = await prisma.sourceEvidence.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: [...IDS] },
      verificationStatus: "PENDING",
    },
    select: {
      id: true,
      dataset: true,
      institutionId: true,
      parentSourceRecordId: true,
      sourceRecordId: true,
      sourceCandidateText: true,
      sourceUrl: true,
      normalizedValue: true,
      normalizedSourceUrl: true,
      assistantAction: true,
      institution: {
        select: {
          id: true,
          name: true,
          verificationStatus: true,
        },
      },
    },
  });

  const byId = new Map(rows.map((r) => [r.sourceRecordId!, r]));
  const missing = IDS.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error(`HARD_STOP: missing evidence rows: ${missing.join(", ")}`);
  }

  for (const id of IDS) {
    const r = byId.get(id)!;
    if (!r.institutionId || !r.institution) {
      throw new Error(`HARD_STOP: unresolved parent for ${id}`);
    }
    if (!r.normalizedValue || !r.normalizedSourceUrl) {
      throw new Error(`HARD_STOP: missing normalized evidence for ${id}`);
    }
  }

  const admissionIds = IDS.slice(0, 5);
  const scholarshipIds = IDS.slice(5);

  const admissionRules = admissionIds.map((id) => {
    const r = byId.get(id)!;
    if (r.dataset !== EvidenceDataset.ADMISSION) {
      throw new Error(`HARD_STOP: ${id} is not ADMISSION`);
    }
    return {
      sourceEvidenceId: r.id,
      sourceCandidateId: id,
      sourceRecordId: `ugc:admission:${id.slice(4).toLowerCase()}`,
      institutionId: r.institutionId!,
      institutionName: r.institution!.name,
      programId: null,
      academicSession: null,
      applicantStage: null,
      allowedGroups: [],
      minimumSscGpa: null,
      minimumHscGpa: null,
      minimumCombinedGpa: null,
      requiredSubjects: null,
      minimumSubjectGrades: null,
      additionalCriteria: r.normalizedValue!,
      sourceUrl: r.normalizedSourceUrl!,
      effectiveFrom: null,
      effectiveUntil: null,
      verificationStatus: "PENDING",
      sourceCandidateIds: [id],
      sourceEvidence: {
        evidenceId: r.id,
        candidateId: id,
        parentSourceRecordId: r.parentSourceRecordId,
        originalSourceUrl: r.sourceUrl,
        normalizedSourceUrl: r.normalizedSourceUrl,
        assistantAction: r.assistantAction,
        normalizedValue: r.normalizedValue,
        promotionPolicy: "EXPLICIT_NORMALIZED_EVIDENCE_ONLY",
      },
    };
  });

  const prime = byId.get("CAN:88dd8e4036c73e68f9a5")!;
  const metro = byId.get("CAN:d14a32d46a725c7e4601")!;

  const scholarships = [
    {
      sourceEvidenceId: prime.id,
      sourceCandidateId: prime.sourceRecordId!,
      sourceRecordId: "ugc:scholarship:88dd8e4036c73e68f9a5",
      institutionId: prime.institutionId!,
      institutionName: prime.institution!.name,
      programId: null,
      title: "First-semester GPA-based scholarship",
      provider: "Prime University",
      description: prime.normalizedValue!,
      eligibility: {
        confirmedPolicy: [
          {
            combinedSscHscGpa: "10.00",
            tuitionWaiverPercent: 100,
          },
        ],
        indicativeDisplayedSlabs: [
          { combinedSscHscGpa: "9.00-9.99", tuitionWaiverPercent: 75 },
          { combinedSscHscGpa: "8.00-8.99", tuitionWaiverPercent: 50 },
          { combinedSscHscGpa: "7.00-7.99", tuitionWaiverPercent: 25 },
        ],
        caveat:
          "The source describes the intermediate 7.00-9.99 slabs as indicative; only the GPA 10.00 to 100% rule is stated as university policy.",
      },
      amountDescription:
        "100% tuition waiver for combined SSC+HSC GPA 10.00. Intermediate 75%/50%/25% slabs are preserved as indicative only.",
      deadline: null,
      sourceUrl: prime.normalizedSourceUrl!,
      verificationStatus: "PENDING",
      sourceCandidateIds: [prime.sourceRecordId!],
      sourceEvidence: {
        evidenceId: prime.id,
        candidateId: prime.sourceRecordId,
        parentSourceRecordId: prime.parentSourceRecordId,
        originalSourceUrl: prime.sourceUrl,
        normalizedSourceUrl: prime.normalizedSourceUrl,
        assistantAction: prime.assistantAction,
        normalizedValue: prime.normalizedValue,
        promotionPolicy: "EXPLICIT_NORMALIZED_EVIDENCE_ONLY_WITH_CAVEAT",
      },
    },
    {
      sourceEvidenceId: metro.id,
      sourceCandidateId: metro.sourceRecordId!,
      sourceRecordId: "ugc:scholarship:d14a32d46a725c7e4601",
      institutionId: metro.institutionId!,
      institutionName: metro.institution!.name,
      programId: null,
      title: "Entry-level merit scholarships",
      provider: "Metropolitan University",
      description: metro.normalizedValue!,
      eligibility: {
        tiers: [
          {
            combinedSscHscGpa: "10",
            goldenGpa5Condition: "both",
            tuitionWaiverPercent: 50,
          },
          {
            combinedSscHscGpa: "10",
            goldenGpa5Condition: "one",
            tuitionWaiverPercent: 30,
          },
          {
            combinedSscHscGpa: "10",
            goldenGpa5Condition: "none",
            tuitionWaiverPercent: 20,
          },
          {
            combinedSscHscGpa: "9",
            goldenGpa5Condition: "not specified",
            tuitionWaiverPercent: 10,
          },
        ],
      },
      amountDescription:
        "Tuition waiver tiers: 50%, 30%, 20%, or 10% according to the documented SSC+HSC GPA and Golden GPA 5.00 conditions.",
      deadline: null,
      sourceUrl: metro.normalizedSourceUrl!,
      verificationStatus: "PENDING",
      sourceCandidateIds: [metro.sourceRecordId!],
      sourceEvidence: {
        evidenceId: metro.id,
        candidateId: metro.sourceRecordId,
        parentSourceRecordId: metro.parentSourceRecordId,
        originalSourceUrl: metro.sourceUrl,
        normalizedSourceUrl: metro.normalizedSourceUrl,
        assistantAction: metro.assistantAction,
        normalizedValue: metro.normalizedValue,
        promotionPolicy: "EXPLICIT_NORMALIZED_EVIDENCE_ONLY",
      },
    },
  ];

  const payload = {
    status: "PASS_STRUCTURED_PROMOTION_STAGING_7",
    mode: "READ_ONLY_BUILD_FROM_DB_EVIDENCE",
    dbWritesPerformed: false,
    counts: {
      admissionRules: admissionRules.length,
      scholarships: scholarships.length,
      total: admissionRules.length + scholarships.length,
    },
    policy: {
      verificationStatus: "PENDING",
      verifiedPublicationPerformed: false,
      sourceEvidenceStatusChanged: false,
      unresolvedParentEvidencePromoted: false,
      academicSessionInferred: false,
      programScopeInferred: false,
      scalarGpaFieldsInferred: false,
      primeIndicativeSlabsTreatedAsConfirmedPolicy: false,
    },
    admissionRules,
    scholarships,
  };

  await writeFile(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    status: payload.status,
    output: out,
    counts: payload.counts,
    policy: payload.policy,
  }, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
