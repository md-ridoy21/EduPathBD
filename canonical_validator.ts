import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

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
  const insertFileArg = arg("--insert-file");
  const linkFileArg = arg("--link-file");

  if (!insertFileArg || !linkFileArg) {
    throw new Error(
      "Usage: npx tsx scripts/validate-ugc-institution-canonical-split.ts " +
      "--insert-file <institution_new_draft_insert_candidates.csv> " +
      "--link-file <institution_existing_lineage_link_proposals.csv>"
    );
  }

  const insertFile = resolve(insertFileArg);
  const linkFile = resolve(linkFileArg);

  const insertRows = parseCsv(await readFile(insertFile, "utf8"));
  const linkRows = parseCsv(await readFile(linkFile, "utf8"));

  const insertValidationErrors: Array<{
    row: number;
    sourceRecordId: string;
    issues: string[];
  }> = [];

  insertRows.forEach((row, index) => {
    const issues: string[] = [];

    const required = [
      "source_id",
      "source_record_id",
      "canonical_name",
      "slug",
      "district_name",
      "district_code",
      "identity_source_url",
      "location_source_url",
      "verification_status",
      "production_verified",
    ];

    for (const field of required) {
      if (!clean(row[field])) issues.push(`${field}: missing`);
    }

    if (row.source_id !== "source_ugc") {
      issues.push("source_id must be source_ugc");
    }
    if (row.verification_status !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }
    if (row.production_verified !== "NO") {
      issues.push("production_verified must be NO");
    }
    if (row.location_review_action !== "RECOMMEND_ACCEPT") {
      issues.push("location_review_action must be RECOMMEND_ACCEPT");
    }
    if (!clean(row.identity_source_url).startsWith("https://")) {
      issues.push("identity_source_url must be HTTPS");
    }
    if (!clean(row.location_source_url).startsWith("https://")) {
      issues.push("location_source_url must be HTTPS");
    }
    if (clean(row.website_url) && !clean(row.website_url).startsWith("https://")) {
      issues.push("website_url must be blank or HTTPS");
    }

    if (issues.length) {
      insertValidationErrors.push({
        row: index + 2,
        sourceRecordId: clean(row.source_record_id),
        issues,
      });
    }
  });

  const linkValidationErrors: Array<{
    row: number;
    sourceRecordId: string;
    issues: string[];
  }> = [];

  linkRows.forEach((row, index) => {
    const issues: string[] = [];

    const required = [
      "source_id",
      "source_record_id",
      "existing_institution_id",
      "canonical_name",
      "slug",
      "district_name",
      "district_code",
      "existing_verification_status",
      "proposed_change",
      "proposed_source_record_id",
      "preserve_verification_status",
      "preserve_existing_fields",
      "human_approval_required",
      "db_write_now",
    ];

    for (const field of required) {
      if (!clean(row[field])) issues.push(`${field}: missing`);
    }

    if (row.source_id !== "source_ugc") {
      issues.push("source_id must be source_ugc");
    }
    if (row.existing_verification_status !== "VERIFIED") {
      issues.push("existing_verification_status must be VERIFIED");
    }
    if (row.proposed_change !== "BACKFILL_SOURCE_RECORD_ID_ONLY") {
      issues.push("proposed_change must be BACKFILL_SOURCE_RECORD_ID_ONLY");
    }
    if (row.proposed_source_record_id !== row.source_record_id) {
      issues.push("proposed_source_record_id must equal source_record_id");
    }
    if (row.preserve_verification_status !== "YES") {
      issues.push("preserve_verification_status must be YES");
    }
    if (row.preserve_existing_fields !== "YES") {
      issues.push("preserve_existing_fields must be YES");
    }
    if (row.human_approval_required !== "YES") {
      issues.push("human_approval_required must be YES");
    }
    if (row.db_write_now !== "NO") {
      issues.push("db_write_now must be NO");
    }

    if (issues.length) {
      linkValidationErrors.push({
        row: index + 2,
        sourceRecordId: clean(row.source_record_id),
        issues,
      });
    }
  });

  const insertSourceIds = insertRows.map((r) => lower(r.source_record_id));
  const linkSourceIds = linkRows.map((r) => lower(r.source_record_id));
  const allSourceIds = [...insertSourceIds, ...linkSourceIds];

  const duplicateInsertSourceIds = duplicates(insertSourceIds);
  const duplicateLinkSourceIds = duplicates(linkSourceIds);
  const duplicateAcrossSplit = duplicates(allSourceIds);

  const sourceUgc = await prisma.dataSource.findUnique({
    where: { id: "source_ugc" },
    select: { id: true, name: true },
  });

  const districtCodes = [
    ...new Set([
      ...insertRows.map((r) => clean(r.district_code)),
      ...linkRows.map((r) => clean(r.district_code)),
    ].filter(Boolean)),
  ];

  const districts = await prisma.district.findMany({
    where: { code: { in: districtCodes } },
    select: { id: true, code: true, name: true, slug: true },
  });

  const districtByCode = new Map(districts.map((d) => [d.code, d]));

  const missingDistrictCodes = districtCodes
    .filter((code) => !districtByCode.has(code))
    .sort();

  const insertDistrictNameMismatches = insertRows
    .filter((row) => {
      const db = districtByCode.get(clean(row.district_code));
      return db && lower(db.name) !== lower(row.district_name);
    })
    .map((row) => ({
      sourceRecordId: row.source_record_id,
      code: row.district_code,
      stagedName: row.district_name,
      databaseName: districtByCode.get(row.district_code)?.name,
    }));

  const insertExistingBySourceRecord = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: {
        in: insertRows.map((r) => clean(r.source_record_id)),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const insertExistingBySlug = await prisma.institution.findMany({
    where: {
      slug: { in: insertRows.map((r) => clean(r.slug)) },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      dataSourceId: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const linkIds = linkRows.map((r) => clean(r.existing_institution_id));

  const existingLinkTargets = await prisma.institution.findMany({
    where: { id: { in: linkIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      district: true,
      districtId: true,
      dataSourceId: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const targetById = new Map(existingLinkTargets.map((r) => [r.id, r]));

  const linkTargetMismatches: Array<Record<string, unknown>> = [];

  for (const row of linkRows) {
    const target = targetById.get(clean(row.existing_institution_id));
    const stagedDistrict = districtByCode.get(clean(row.district_code));

    if (!target) {
      linkTargetMismatches.push({
        sourceRecordId: row.source_record_id,
        issue: "existing target missing",
        existingInstitutionId: row.existing_institution_id,
      });
      continue;
    }

    const issues: string[] = [];

    if (target.name !== clean(row.canonical_name)) issues.push("name mismatch");
    if (target.slug !== clean(row.slug)) issues.push("slug mismatch");
    if (lower(target.district) !== lower(row.district_name)) {
      issues.push("district string mismatch");
    }
    if (!stagedDistrict) issues.push("staged district code does not resolve");
    else if (target.districtId !== stagedDistrict.id) {
      issues.push("districtId mismatch");
    }
    if (target.dataSourceId !== "source_ugc") {
      issues.push("dataSourceId mismatch");
    }
    if (target.sourceRecordId !== null) {
      issues.push("target sourceRecordId is not null");
    }
    if (String(target.verificationStatus) !== "VERIFIED") {
      issues.push("existing verificationStatus is not VERIFIED");
    }

    if (issues.length) {
      linkTargetMismatches.push({
        sourceRecordId: row.source_record_id,
        existingInstitutionId: row.existing_institution_id,
        issues,
        database: target,
      });
    }
  }

  const linkSourceRecordIds = linkRows.map((r) => clean(r.source_record_id));

  const linkSourceRecordAlreadyUsed = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: linkSourceRecordIds },
    },
    select: {
      id: true,
      name: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const expectedLinkTargets = new Set(["inst_du", "inst_cu"]);
  const expectedLinkSourceIds = new Set(["ugc:public:1", "ugc:public:5"]);

  const linkTargetIdsExact =
    linkRows.length === 2 &&
    linkRows.every((r) => expectedLinkTargets.has(clean(r.existing_institution_id)));

  const linkSourceIdsExact =
    linkRows.length === 2 &&
    linkRows.every((r) => expectedLinkSourceIds.has(lower(r.source_record_id)));

  const checks = {
    expectedInsertRows108: insertRows.length === 108,
    expectedLineageRows2: linkRows.length === 2,
    insertRowsValid: insertValidationErrors.length === 0,
    lineageRowsValid: linkValidationErrors.length === 0,
    sourceUgcRegistered: Boolean(sourceUgc),
    noDuplicateInsertSourceIds: duplicateInsertSourceIds.length === 0,
    noDuplicateLineageSourceIds: duplicateLinkSourceIds.length === 0,
    noDuplicateAcrossSplit: duplicateAcrossSplit.length === 0,
    allDistrictCodesResolve: missingDistrictCodes.length === 0,
    noInsertDistrictNameMismatches: insertDistrictNameMismatches.length === 0,
    noInsertSourceRecordCollisions: insertExistingBySourceRecord.length === 0,
    noInsertSlugCollisions: insertExistingBySlug.length === 0,
    exactExpectedLineageTargets: linkTargetIdsExact,
    exactExpectedLineageSourceIds: linkSourceIdsExact,
    lineageTargetsMatchDatabase: linkTargetMismatches.length === 0,
    lineageSourceRecordIdsUnused: linkSourceRecordAlreadyUsed.length === 0,
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  const status =
    hardStopReasons.length === 0
      ? "READY_FOR_HUMAN_APPROVAL_AND_IMPORT_DESIGN"
      : "HARD_STOP";

  console.log(JSON.stringify({
    status,
    mode: "READ_ONLY_CANONICAL_SPLIT_VALIDATION",
    dbWritesPerformed: false,
    insertFile,
    linkFile,

    insertRowsRead: insertRows.length,
    lineageRowsRead: linkRows.length,
    totalCanonicalRows: insertRows.length + linkRows.length,

    insertValidationErrors: insertValidationErrors.length,
    lineageValidationErrors: linkValidationErrors.length,

    sourceUgcRegistered: Boolean(sourceUgc),

    districtCodesRequired: districtCodes.length,
    databaseDistrictMatches: districts.length,
    missingDistrictCodes: missingDistrictCodes.length,
    insertDistrictNameMismatches: insertDistrictNameMismatches.length,

    existingInsertSourceRecordCollisions: insertExistingBySourceRecord.length,
    existingInsertSlugCollisions: insertExistingBySlug.length,

    existingLineageTargetsFound: existingLinkTargets.length,
    lineageTargetMismatches: linkTargetMismatches.length,
    lineageSourceRecordIdsAlreadyUsed: linkSourceRecordAlreadyUsed.length,

    duplicateInsertSourceIds: duplicateInsertSourceIds.length,
    duplicateLineageSourceIds: duplicateLinkSourceIds.length,
    duplicateAcrossSplit: duplicateAcrossSplit.length,

    policy: {
      newRowsVerificationStatus: "DRAFT",
      newRowsProductionVerified: "NO",
      existingVerifiedRowsPreserved: true,
      lineageChangeScope: "sourceRecordId only",
      humanApprovalRequiredBeforeAnyWrite: true,
      verifiedPublicationAllowed: false,
    },

    checks,
    hardStopReasons,

    samples: {
      insertValidationErrors: insertValidationErrors.slice(0, 10),
      lineageValidationErrors: linkValidationErrors.slice(0, 10),
      missingDistrictCodes: missingDistrictCodes.slice(0, 20),
      insertDistrictNameMismatches: insertDistrictNameMismatches.slice(0, 20),
      existingInsertSourceRecordCollisions: insertExistingBySourceRecord.slice(0, 20),
      existingInsertSlugCollisions: insertExistingBySlug.slice(0, 20),
      lineageTargetMismatches: linkTargetMismatches.slice(0, 20),
      lineageSourceRecordIdsAlreadyUsed: linkSourceRecordAlreadyUsed.slice(0, 20),
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
