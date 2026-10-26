import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

const BLOCKED_PARENT_IDS = new Set([
  "ugc:public:46",
  "ugc:public:36",
  "ugc:private:84",
  "ugc:private:77",
  "ugc:private:100",
  "ugc:private:12",
  "ugc:international:3",
]);

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function lower(v: unknown): string {
  return clean(v).toLowerCase();
}

function parseCsv(text: string): Row[] {
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

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
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
      const out: Row = {};
      headers.forEach((h, i) => {
        out[h] = (r[i] ?? "").trim();
      });
      return out;
    });
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

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const fileArg = arg("--file");

  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/validate-resolved-ugc-program-staging.ts --file <program_resolved_parent_draft_ready.csv>"
    );
  }

  const file = resolve(fileArg);
  const raw = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const rows = parseCsv(raw);

  const validationErrors: Array<{
    row: number;
    stagingId: string;
    issues: string[];
  }> = [];

  rows.forEach((row, index) => {
    const issues: string[] = [];

    const required = [
      "staging_id",
      "parent_source_record_id",
      "institution_name",
      "program_name",
      "program_slug",
      "degree_level",
      "degree_award",
      "program_source_url",
      "verification_status",
      "production_verified",
      "staging_package",
    ];

    for (const field of required) {
      if (!clean(row[field])) issues.push(`${field}: missing`);
    }

    if (clean(row.verification_status) !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }

    if (clean(row.production_verified) !== "NO") {
      issues.push("production_verified must be NO");
    }

    if (clean(row.staging_package) !== "v6.3") {
      issues.push("staging_package must be v6.3");
    }

    if (!clean(row.program_source_url).startsWith("https://")) {
      issues.push("program_source_url must use HTTPS");
    }

    if (!clean(row.institution_identity_source_url).startsWith("https://")) {
      issues.push("institution_identity_source_url must use HTTPS");
    }

    if (BLOCKED_PARENT_IDS.has(lower(row.parent_source_record_id))) {
      issues.push("policy-blocked parent leaked into resolved-parent staging");
    }

    if (issues.length) {
      validationErrors.push({
        row: index + 2,
        stagingId: clean(row.staging_id),
        issues,
      });
    }
  });

  const stagingIds = rows.map((r) => clean(r.staging_id));
  const parentSlugKeys = rows.map(
    (r) => `${lower(r.parent_source_record_id)}|${lower(r.program_slug)}`
  );

  const duplicateStagingIds = duplicates(stagingIds);
  const duplicateParentSlug = duplicates(parentSlugKeys);

  const requiredParentIds = [
    ...new Set(rows.map((r) => lower(r.parent_source_record_id))),
  ];

  const databaseParents = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: requiredParentIds },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      district: true,
      districtId: true,
      verificationStatus: true,
    },
  });

  const parentBySourceId = new Map<
    string,
    Array<(typeof databaseParents)[number]>
  >();

  for (const parent of databaseParents) {
    const key = lower(parent.sourceRecordId);
    const list = parentBySourceId.get(key) ?? [];
    list.push(parent);
    parentBySourceId.set(key, list);
  }

  const missingParents = requiredParentIds
    .filter((id) => (parentBySourceId.get(id) ?? []).length === 0)
    .sort();

  const ambiguousParents = requiredParentIds
    .filter((id) => (parentBySourceId.get(id) ?? []).length > 1)
    .sort();

  const parentsWithoutLocation = databaseParents
    .filter((p) => !clean(p.district) || !clean(p.districtId))
    .map((p) => ({
      id: p.id,
      sourceRecordId: p.sourceRecordId,
      name: p.name,
      district: p.district,
      districtId: p.districtId,
    }));

  const parentNameMismatches: Array<{
    sourceRecordId: string;
    stagedInstitutionName: string;
    databaseInstitutionName: string;
    databaseInstitutionId: string;
  }> = [];

  const seenNameMismatch = new Set<string>();

  for (const row of rows) {
    const rid = lower(row.parent_source_record_id);
    const matches = parentBySourceId.get(rid) ?? [];

    if (matches.length !== 1) continue;

    const parent = matches[0]!;
    if (lower(parent.name) !== lower(row.institution_name)) {
      const key = `${rid}|${lower(row.institution_name)}|${lower(parent.name)}`;
      if (!seenNameMismatch.has(key)) {
        seenNameMismatch.add(key);
        parentNameMismatches.push({
          sourceRecordId: rid,
          stagedInstitutionName: clean(row.institution_name),
          databaseInstitutionName: parent.name,
          databaseInstitutionId: parent.id,
        });
      }
    }
  }

  const programSourceRecordIds = rows.map((r) => clean(r.staging_id));

  // Program sourceRecordId import policy: use stable staging_id as the Program.sourceRecordId.
  // This validator only checks collisions; it performs no write.
  const existingBySourceRecord = await prisma.program.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: programSourceRecordIds },
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

  const resolvedRows = rows
    .map((row) => {
      const rid = lower(row.parent_source_record_id);
      const parent = (parentBySourceId.get(rid) ?? [])[0];
      return parent
        ? {
            row,
            parent,
          }
        : null;
    })
    .filter(
      (
        item
      ): item is {
        row: Row;
        parent: (typeof databaseParents)[number];
      } => Boolean(item)
    );

  const institutionIds = [
    ...new Set(resolvedRows.map((item) => item.parent.id)),
  ];
  const slugs = [...new Set(rows.map((r) => clean(r.program_slug)))];

  const existingParentSlugRows = await prisma.program.findMany({
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

  const stagedParentSlugSet = new Set(
    resolvedRows.map(({ row, parent }) => `${parent.id}|${lower(row.program_slug)}`)
  );

  const exactExistingParentSlugCollisions = existingParentSlugRows.filter((p) =>
    stagedParentSlugSet.has(`${p.institutionId}|${lower(p.slug)}`)
  );

  const blockedRows = rows.filter((r) =>
    BLOCKED_PARENT_IDS.has(lower(r.parent_source_record_id))
  );

  const checks = {
    expectedRows1542: rows.length === 1542,
    allRowsValidated: validationErrors.length === 0,
    noDuplicateStagingIds: duplicateStagingIds.length === 0,
    noDuplicateParentSlug: duplicateParentSlug.length === 0,
    noBlockedParentsLeaked: blockedRows.length === 0,
    allRequiredParentsResolved: missingParents.length === 0,
    noAmbiguousParents: ambiguousParents.length === 0,
    allParentsHaveLocation: parentsWithoutLocation.length === 0,
    noParentNameMismatches: parentNameMismatches.length === 0,
    noExistingProgramSourceRecordCollisions:
      existingBySourceRecord.length === 0,
    noExistingParentSlugCollisions:
      exactExistingParentSlugCollisions.length === 0,
    allRowsDraft: rows.every((r) => clean(r.verification_status) === "DRAFT"),
    allRowsNotProductionVerified:
      rows.every((r) => clean(r.production_verified) === "NO"),
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  const status =
    hardStopReasons.length === 0
      ? "READY_FOR_PROGRAM_PAYLOAD_DRY_RUN"
      : "HARD_STOP";

  console.log(JSON.stringify({
    status,
    mode: "READ_ONLY_RESOLVED_PROGRAM_VALIDATION",
    dbWritesPerformed: false,
    file,
    sha256,
    recordsRead: rows.length,
    recordsValidated: rows.length - validationErrors.length,
    validationErrors: validationErrors.length,
    duplicateStagingIds: duplicateStagingIds.length,
    duplicateParentSlug: duplicateParentSlug.length,
    blockedRowsLeaked: blockedRows.length,
    requiredParentIds: requiredParentIds.length,
    databaseParentsMatched: databaseParents.length,
    missingParents: missingParents.length,
    ambiguousParents: ambiguousParents.length,
    parentsWithoutLocation: parentsWithoutLocation.length,
    parentNameMismatches: parentNameMismatches.length,
    existingProgramSourceRecordCollisions: existingBySourceRecord.length,
    existingParentSlugCollisions: exactExistingParentSlugCollisions.length,
    sourceRecordIdPolicy: "Program.sourceRecordId = staging_id",
    verificationPolicy: {
      requiredProgramStatus: "DRAFT",
      requiredProductionVerified: "NO",
      verifiedPublicationAllowed: false,
    },
    checks,
    hardStopReasons,
    samples: {
      validationErrors: validationErrors.slice(0, 10),
      duplicateStagingIds: duplicateStagingIds.slice(0, 20),
      duplicateParentSlug: duplicateParentSlug.slice(0, 20),
      blockedRows: blockedRows.slice(0, 10).map((r) => ({
        stagingId: r.staging_id,
        parentSourceRecordId: r.parent_source_record_id,
        programName: r.program_name,
      })),
      missingParents: missingParents.slice(0, 20),
      ambiguousParents: ambiguousParents.slice(0, 20),
      parentsWithoutLocation: parentsWithoutLocation.slice(0, 20),
      parentNameMismatches: parentNameMismatches.slice(0, 20),
      existingProgramSourceRecordCollisions:
        existingBySourceRecord.slice(0, 20),
      existingParentSlugCollisions:
        exactExistingParentSlugCollisions.slice(0, 20),
    },
  }, null, 2));

  if (status === "HARD_STOP") {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
