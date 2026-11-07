import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EvidenceDataset, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROMOTED_SOURCE_IDS = new Set([
  "CAN:c0a3d4764ee81eb5dab5",
  "CAN:b6a1be2c9002210a3ddc",
  "CAN:9dc20b5db7bf99a63773",
  "CAN:2cfcf6cf8f3b0b090869",
  "CAN:393cf3a4505c9af03469",
  "CAN:88dd8e4036c73e68f9a5",
  "CAN:d14a32d46a725c7e4601",
]);

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function clean(v: unknown) {
  return String(v ?? "").trim();
}
function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(clean).filter(Boolean) : [];
}
function csvCell(v: unknown) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}
function groupId(dataset: string, parent: string, url: string) {
  return `${dataset.toLowerCase()}-policy:${createHash("sha256")
    .update(`${parent.toLowerCase()}|${url.toLowerCase()}`)
    .digest("hex")
    .slice(0, 24)}`;
}

type EvidenceRow = Awaited<ReturnType<typeof fetchRows>>[number];

async function fetchRows() {
  return prisma.sourceEvidence.findMany({
    where: {
      dataSourceId: "source_ugc",
      verificationStatus: "PENDING",
      OR: [
        {
          dataset: EvidenceDataset.ADMISSION,
          candidateType: "GPA_OR_ELIGIBILITY",
        },
        {
          dataset: EvidenceDataset.SCHOLARSHIP,
        },
      ],
    },
    select: {
      id: true,
      dataset: true,
      institutionId: true,
      parentSourceRecordId: true,
      candidateType: true,
      sourceRecordId: true,
      sourceCandidateText: true,
      sourceUrl: true,
      pageSha256Values: true,
      extractedValues: true,
      assistantDecision: true,
      assistantAction: true,
      normalizedValue: true,
      normalizedSourceUrl: true,
      institution: {
        select: {
          name: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: [
      { dataset: "asc" },
      { parentSourceRecordId: "asc" },
      { sourceUrl: "asc" },
      { sourceRecordId: "asc" },
    ],
  });
}

function sourceRiskFlags(url: string, texts: string[]) {
  const flags: string[] = [];
  const u = url.toLowerCase();
  const combined = texts.join(" ").toLowerCase();

  if (!u.startsWith("https://")) flags.push("NON_HTTPS_SOURCE");

  const historicalYears = [...u.matchAll(/\b(20\d{2})\b/g), ...combined.matchAll(/\b(20\d{2})\b/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 2000 && y <= 2025);
  if (historicalYears.length) flags.push("HISTORICAL_YEAR_REFERENCE");

  if (/(\/notice|\/news|\/event|circular|result|admission-test-result)/i.test(url)) {
    flags.push("NOTICE_OR_EVENT_SOURCE");
  }
  if (/\/program\b|\/programs\b/i.test(url)) {
    flags.push("PROGRAM_SPECIFIC_SOURCE");
  }
  if (/(temporary|indicative|subject to change|may change|provisional)/i.test(combined)) {
    flags.push("CAVEAT_OR_PROVISIONAL_LANGUAGE");
  }

  return uniq(flags);
}

(async () => {
  const outDir = resolve(
    arg("--out") ??
      `${process.env.HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3/admission-scholarship-reconstruction-audit-256`,
  );
  await mkdir(outDir, { recursive: true });

  const rows = await fetchRows();

  const groups = new Map<string, EvidenceRow[]>();
  for (const row of rows) {
    const parent = clean(row.parentSourceRecordId);
    const url = clean(row.sourceUrl);
    const key = `${row.dataset}|${parent}|${url}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const records = [...groups.entries()].map(([key, items]) => {
    const first = items[0]!;
    const parent = clean(first.parentSourceRecordId);
    const url = clean(first.sourceUrl);
    const dataset = first.dataset;

    const candidateIds = uniq(items.map((x) => clean(x.sourceRecordId)));
    const promotedIds = candidateIds.filter((id) => PROMOTED_SOURCE_IDS.has(id));
    const texts = items.map((x) => clean(x.sourceCandidateText)).filter(Boolean);
    const normalizedValues = uniq(items.map((x) => clean(x.normalizedValue)));
    const normalizedSources = uniq(items.map((x) => clean(x.normalizedSourceUrl)));

    const suggestedGpaValues: string[] = [];
    const suggestedMoneyValues: string[] = [];
    const suggestedDateValues: string[] = [];
    const suggestedPercentValues: string[] = [];
    const finalScholarshipNames: string[] = [];
    const finalAwardPercent: string[] = [];
    const finalAwardAmount: string[] = [];
    const finalMinimumGpa: string[] = [];
    const finalEligibility: string[] = [];
    const finalDeadline: string[] = [];
    const finalRenewalCondition: string[] = [];

    for (const item of items) {
      const x = asObject(item.extractedValues);
      suggestedGpaValues.push(...arr(x.suggestedGpaValues));
      suggestedMoneyValues.push(...arr(x.suggestedMoneyValues));
      suggestedDateValues.push(...arr(x.suggestedDateValues));
      suggestedPercentValues.push(...arr(x.suggestedPercentValues));

      for (const [field, target] of [
        ["finalScholarshipName", finalScholarshipNames],
        ["finalAwardPercent", finalAwardPercent],
        ["finalAwardAmount", finalAwardAmount],
        ["finalMinimumGpa", finalMinimumGpa],
        ["finalEligibility", finalEligibility],
        ["finalDeadline", finalDeadline],
        ["finalRenewalCondition", finalRenewalCondition],
      ] as const) {
        const v = clean(x[field]);
        if (v) target.push(v);
      }
    }

    const riskFlags = sourceRiskFlags(url, texts);

    if (!first.institutionId || !first.institution) {
      riskFlags.push("UNRESOLVED_PARENT");
    }
    if (promotedIds.length) {
      riskFlags.push("CONTAINS_ALREADY_PROMOTED_FRAGMENT");
    }
    if (normalizedValues.length > 1) {
      riskFlags.push("MULTIPLE_NORMALIZED_VALUES");
    }

    const gpas = uniq(suggestedGpaValues);
    const money = uniq(suggestedMoneyValues);
    const dates = uniq(suggestedDateValues);
    const percents = uniq(suggestedPercentValues);

    if (dataset === EvidenceDataset.ADMISSION && gpas.length > 1) {
      riskFlags.push("MULTI_GPA_VALUES_NEEDS_RULE_RECONSTRUCTION");
    }
    if (dataset === EvidenceDataset.SCHOLARSHIP && percents.length > 1) {
      riskFlags.push("MULTI_PERCENT_VALUES_NEEDS_TIER_RECONSTRUCTION");
    }
    if (dataset === EvidenceDataset.SCHOLARSHIP && money.length > 1) {
      riskFlags.push("MULTI_MONEY_VALUES_NEEDS_TIER_RECONSTRUCTION");
    }
    if (dates.length > 1) {
      riskFlags.push("MULTI_DATE_VALUES_NEEDS_SCOPE_REVIEW");
    }

    let reconstructionBucket:
      | "BLOCKED_PARENT"
      | "SOURCE_SCOPE_REVIEW"
      | "READY_FOR_MANUAL_RECONSTRUCTION";

    if (riskFlags.includes("UNRESOLVED_PARENT")) {
      reconstructionBucket = "BLOCKED_PARENT";
    } else if (
      riskFlags.some((f) =>
        [
          "NON_HTTPS_SOURCE",
          "HISTORICAL_YEAR_REFERENCE",
          "NOTICE_OR_EVENT_SOURCE",
          "PROGRAM_SPECIFIC_SOURCE",
          "CAVEAT_OR_PROVISIONAL_LANGUAGE",
        ].includes(f),
      )
    ) {
      reconstructionBucket = "SOURCE_SCOPE_REVIEW";
    } else {
      reconstructionBucket = "READY_FOR_MANUAL_RECONSTRUCTION";
    }

    return {
      groupId: groupId(dataset, parent, url),
      dataset,
      parentSourceRecordId: parent,
      institutionId: first.institutionId,
      institutionName: first.institution?.name ?? null,
      institutionVerificationStatus: first.institution?.verificationStatus ?? null,
      sourceUrl: url,
      fragmentCount: items.length,
      candidateIds,
      promotedCandidateIds: promotedIds,
      unpromotedCandidateIds: candidateIds.filter((id) => !PROMOTED_SOURCE_IDS.has(id)),
      pageSha256Values: uniq(items.flatMap((x) => x.pageSha256Values)),
      assistantActions: uniq(items.map((x) => clean(x.assistantAction))),
      normalizedValues,
      normalizedSources,
      extracted: {
        suggestedGpaValues: gpas,
        suggestedMoneyValues: money,
        suggestedDateValues: dates,
        suggestedPercentValues: percents,
        finalScholarshipNames: uniq(finalScholarshipNames),
        finalAwardPercent: uniq(finalAwardPercent),
        finalAwardAmount: uniq(finalAwardAmount),
        finalMinimumGpa: uniq(finalMinimumGpa),
        finalEligibility: uniq(finalEligibility),
        finalDeadline: uniq(finalDeadline),
        finalRenewalCondition: uniq(finalRenewalCondition),
      },
      sourceTexts: texts,
      riskFlags: uniq(riskFlags),
      reconstructionBucket,
      autoPromotionAllowed: false,
      recommendedNextAction:
        reconstructionBucket === "BLOCKED_PARENT"
          ? "RESOLVE_PARENT_BEFORE_RECONSTRUCTION"
          : reconstructionBucket === "SOURCE_SCOPE_REVIEW"
            ? "REVIEW_SOURCE_SCOPE_AND_CURRENTNESS"
            : "MANUAL_SOURCE_BACKED_RECONSTRUCTION",
    };
  });

  const admissionGroups = records.filter((x) => x.dataset === EvidenceDataset.ADMISSION);
  const scholarshipGroups = records.filter((x) => x.dataset === EvidenceDataset.SCHOLARSHIP);

  const bucketCounts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.reconstructionBucket] = (acc[r.reconstructionBucket] ?? 0) + 1;
    return acc;
  }, {});

  const unresolvedGroups = records.filter((x) => x.riskFlags.includes("UNRESOLVED_PARENT"));
  const promotedOverlapGroups = records.filter((x) => x.promotedCandidateIds.length > 0);

  const checks = {
    admissionGroups84: admissionGroups.length === 84,
    scholarshipGroups172: scholarshipGroups.length === 172,
    totalGroups256: records.length === 256,
    autoPromotionDisabledForAll: records.every((x) => x.autoPromotionAllowed === false),
    promotedIdsKnownOnly: records.every((x) =>
      x.promotedCandidateIds.every((id) => PROMOTED_SOURCE_IDS.has(id)),
    ),
  };

  const manifest = {
    status: Object.values(checks).every(Boolean)
      ? "PASS_RECONSTRUCTION_AUDIT_256"
      : "HARD_STOP",
    mode: "READ_ONLY_DB_TO_FILES",
    dbWritesPerformed: false,
    counts: {
      evidenceRowsRead: rows.length,
      admissionGroups: admissionGroups.length,
      scholarshipGroups: scholarshipGroups.length,
      totalGroups: records.length,
      unresolvedParentGroups: unresolvedGroups.length,
      alreadyPromotedOverlapGroups: promotedOverlapGroups.length,
      bucketCounts,
    },
    checks,
    policy: {
      autoPromotionPerformed: false,
      autoPromotionAllowedForRemainingGroups: false,
      sourceFactsSynthesized: false,
      verifiedPublicationPerformed: false,
      feeFragmentsIncludedInAdmissionGroups: false,
      deadlineFragmentsIncludedInAdmissionGroups: false,
    },
  };

  const jsonPath = resolve(outDir, "reconstruction-groups-256.json");
  const csvPath = resolve(outDir, "reconstruction-groups-256.csv");
  const manifestPath = resolve(outDir, "RECONSTRUCTION_AUDIT_MANIFEST.json");

  await writeFile(
    jsonPath,
    JSON.stringify({ manifest, groups: records }, null, 2) + "\n",
    "utf8",
  );

  const headers = [
    "groupId",
    "dataset",
    "parentSourceRecordId",
    "institutionId",
    "institutionName",
    "institutionVerificationStatus",
    "sourceUrl",
    "fragmentCount",
    "reconstructionBucket",
    "riskFlags",
    "promotedCandidateIds",
    "unpromotedCandidateIds",
    "suggestedGpaValues",
    "suggestedMoneyValues",
    "suggestedDateValues",
    "suggestedPercentValues",
    "normalizedValues",
    "recommendedNextAction",
  ];

  const csv = [
    headers.map(csvCell).join(","),
    ...records.map((r) =>
      [
        r.groupId,
        r.dataset,
        r.parentSourceRecordId,
        r.institutionId ?? "",
        r.institutionName ?? "",
        r.institutionVerificationStatus ?? "",
        r.sourceUrl,
        r.fragmentCount,
        r.reconstructionBucket,
        r.riskFlags.join(" | "),
        r.promotedCandidateIds.join(" | "),
        r.unpromotedCandidateIds.join(" | "),
        r.extracted.suggestedGpaValues.join(" | "),
        r.extracted.suggestedMoneyValues.join(" | "),
        r.extracted.suggestedDateValues.join(" | "),
        r.extracted.suggestedPercentValues.join(" | "),
        r.normalizedValues.join(" | "),
        r.recommendedNextAction,
      ]
        .map(csvCell)
        .join(","),
    ),
  ].join("\n") + "\n";

  await writeFile(csvPath, csv, "utf8");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log(JSON.stringify({
    ...manifest,
    files: { jsonPath, csvPath, manifestPath },
  }, null, 2));

  if (manifest.status !== "PASS_RECONSTRUCTION_AUDIT_256") {
    process.exitCode = 2;
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
