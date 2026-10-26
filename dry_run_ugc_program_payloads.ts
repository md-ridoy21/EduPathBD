import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CsvRow = Record<string, string>;

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function lower(v: unknown): string {
  return clean(v).toLowerCase();
}

function canonicalProgramSourceRecordId(parentSourceRecordId: string, programSlug: string) {
  const identity = `${lower(parentSourceRecordId)}|${lower(programSlug)}`;
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `ugc:program:${hash}`;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0]!.map((h) => h.trim());

  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => {
      const out: CsvRow = {};
      headers.forEach((h, i) => {
        out[h] = (r[i] ?? "").trim();
      });
      return out;
    });
}

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

async function main() {
  const fileArg = arg("--file");
  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/dry-run-ugc-program-payloads.ts --file <program_direct_clean_1438.csv>"
    );
  }

  const file = resolve(fileArg);
  const raw = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const rows = parseCsv(raw);

  const requiredParentIds = [
    ...new Set(rows.map((r) => lower(r.parent_source_record_id))),
  ];

  const parents = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: requiredParentIds },
    },
    select: {
      id: true,
      name: true,
      sourceRecordId: true,
      district: true,
      districtId: true,
      verificationStatus: true,
    },
  });

  const parentMap = new Map<string, (typeof parents)[number][]>();
  for (const p of parents) {
    const key = lower(p.sourceRecordId);
    const list = parentMap.get(key) ?? [];
    list.push(p);
    parentMap.set(key, list);
  }

  const payloadErrors: Array<{
    row: number;
    stagingId: string;
    issues: string[];
  }> = [];

  const payloads: Array<{
    institutionId: string;
    name: string;
    slug: string;
    level: string;
    pathwayCategory: "UNIVERSITY_GENERAL";
    entryStage: null;
    subjectAreas: string[];
    availableGroups: string[];
    dataSourceId: "source_ugc";
    sourceRecordId: string;
    durationMonths: null;
    tuitionMin: null;
    tuitionMax: null;
    description: null;
    careerOutcomes: string[];
    verificationStatus: "DRAFT";
    sourceUrl: string;
    _meta: {
      stagingId: string;
      parentSourceRecordId: string;
      degreeAward: string;
      candidateIds: string;
    };
  }> = [];

  rows.forEach((row, index) => {
    const issues: string[] = [];
    const parentSourceId = lower(row.parent_source_record_id);
    const matches = parentMap.get(parentSourceId) ?? [];

    if (matches.length === 0) issues.push("parent not found");
    if (matches.length > 1) issues.push("parent ambiguous");

    const name = clean(row.program_name);
    const slug = clean(row.program_slug);
    const level = clean(row.degree_level);
    const sourceUrl = clean(row.program_source_url);

    if (!name) issues.push("program_name missing");
    if (!slug) issues.push("program_slug missing");
    if (!level) issues.push("degree_level missing");
    if (!sourceUrl.startsWith("https://")) issues.push("program_source_url must use HTTPS");
    if (clean(row.verification_status) !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }
    if (clean(row.production_verified) !== "NO") {
      issues.push("production_verified must be NO");
    }

    if (matches.length === 1) {
      const parent = matches[0]!;
      if (!clean(parent.district) || !clean(parent.districtId)) {
        issues.push("parent location incomplete");
      }
      if (lower(parent.name) !== lower(row.institution_name)) {
        issues.push("parent institution name mismatch");
      }

      payloads.push({
        institutionId: parent.id,
        name,
        slug,
        level,
        pathwayCategory: "UNIVERSITY_GENERAL",
        entryStage: null,
        subjectAreas: [],
        availableGroups: [],
        dataSourceId: "source_ugc",
        sourceRecordId: canonicalProgramSourceRecordId(
          row.parent_source_record_id,
          row.program_slug
        ),
        durationMonths: null,
        tuitionMin: null,
        tuitionMax: null,
        description: null,
        careerOutcomes: [],
        verificationStatus: "DRAFT",
        sourceUrl,
        _meta: {
          stagingId: clean(row.staging_id),
          parentSourceRecordId: parentSourceId,
          degreeAward: clean(row.degree_award),
          candidateIds: clean(row.candidate_ids),
        },
      });
    }

    if (issues.length) {
      payloadErrors.push({
        row: index + 2,
        stagingId: clean(row.staging_id),
        issues,
      });
    }
  });

  const sourceRecordIds = payloads.map((p) => p.sourceRecordId);
  const parentSlugKeys = payloads.map((p) => `${p.institutionId}|${lower(p.slug)}`);

  const duplicateSourceRecordIds = duplicates(sourceRecordIds);
  const duplicateParentSlug = duplicates(parentSlugKeys);

  const existingSourceCollisions = await prisma.program.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: sourceRecordIds },
    },
    select: {
      id: true,
      institutionId: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const institutionIds = [...new Set(payloads.map((p) => p.institutionId))];
  const slugs = [...new Set(payloads.map((p) => p.slug))];

  const existingParentSlugCandidates = await prisma.program.findMany({
    where: {
      institutionId: { in: institutionIds },
      slug: { in: slugs },
    },
    select: {
      id: true,
      institutionId: true,
      name: true,
      slug: true,
      dataSourceId: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const stagedParentSlugSet = new Set(parentSlugKeys);
  const existingParentSlugCollisions = existingParentSlugCandidates.filter((p) =>
    stagedParentSlugSet.has(`${p.institutionId}|${lower(p.slug)}`)
  );

  const levelCounts = payloads.reduce<Record<string, number>>((acc, p) => {
    acc[p.level] = (acc[p.level] ?? 0) + 1;
    return acc;
  }, {});

  const parentVerificationCounts = parents.reduce<Record<string, number>>((acc, p) => {
    acc[p.verificationStatus] = (acc[p.verificationStatus] ?? 0) + 1;
    return acc;
  }, {});

  const checks = {
    expectedRows1438: rows.length === 1438,
    allPayloadsConstructed: payloads.length === 1438,
    noPayloadErrors: payloadErrors.length === 0,
    allRequiredParentsResolvedExactlyOnce:
      requiredParentIds.every((id) => (parentMap.get(id) ?? []).length === 1),
    noDuplicateCanonicalSourceRecordIds: duplicateSourceRecordIds.length === 0,
    noDuplicateInstitutionSlug: duplicateParentSlug.length === 0,
    noExistingSourceRecordCollisions: existingSourceCollisions.length === 0,
    noExistingInstitutionSlugCollisions: existingParentSlugCollisions.length === 0,
    allPayloadsDraft:
      payloads.every((p) => p.verificationStatus === "DRAFT"),
    allPayloadsSourceUgc:
      payloads.every((p) => p.dataSourceId === "source_ugc"),
    allPayloadsHttps:
      payloads.every((p) => p.sourceUrl.startsWith("https://")),
    noVerifiedPublication:
      payloads.every((p) => p.verificationStatus !== "VERIFIED"),
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  console.log(JSON.stringify({
    status:
      hardStopReasons.length === 0
        ? "READY_FOR_EXPLICIT_HUMAN_APPROVAL_TO_IMPLEMENT_PROGRAM_IMPORTER"
        : "HARD_STOP",
    mode: "READ_ONLY_PROGRAM_PAYLOAD_DRY_RUN",
    dbWritesPerformed: false,
    file,
    sha256,
    rowsRead: rows.length,
    payloadsConstructed: payloads.length,
    payloadErrors: payloadErrors.length,
    requiredParentIds: requiredParentIds.length,
    databaseParentsMatched: parents.length,
    parentVerificationCounts,
    duplicateCanonicalSourceRecordIds: duplicateSourceRecordIds.length,
    duplicateInstitutionSlug: duplicateParentSlug.length,
    existingSourceRecordCollisions: existingSourceCollisions.length,
    existingInstitutionSlugCollisions: existingParentSlugCollisions.length,
    levelCounts,
    payloadPolicy: {
      institutionId: "resolved by source_ugc + parent_source_record_id",
      name: "program_name",
      slug: "program_slug",
      level: "degree_level",
      pathwayCategory: "UNIVERSITY_GENERAL",
      entryStage: null,
      subjectAreas: [],
      availableGroups: [],
      dataSourceId: "source_ugc",
      sourceRecordId:
        "ugc:program:<sha256(lower(parent_source_record_id)|lower(program_slug))[:32]>",
      durationMonths: null,
      tuitionMin: null,
      tuitionMax: null,
      description: null,
      careerOutcomes: [],
      verificationStatus: "DRAFT",
      sourceUrl: "program_source_url",
      degreeAward: "preserved only as dry-run metadata; Program model has no degreeAward field",
      productionVerified: "NO in staging only; Program model has no productionVerified field",
      verifiedPublicationAllowed: false,
    },
    checks,
    hardStopReasons,
    samples: {
      payloadErrors: payloadErrors.slice(0, 10),
      duplicateCanonicalSourceRecordIds: duplicateSourceRecordIds.slice(0, 10),
      duplicateInstitutionSlug: duplicateParentSlug.slice(0, 10),
      existingSourceRecordCollisions: existingSourceCollisions.slice(0, 10),
      existingInstitutionSlugCollisions: existingParentSlugCollisions.slice(0, 10),
      payloads: payloads.slice(0, 5),
    },
  }, null, 2));

  if (hardStopReasons.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
