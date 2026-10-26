import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CsvRow = Record<string, string>;

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

  const headers = rows[0]!.map((v) => v.trim());

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

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function duplicates(values: string[]): string[] {
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
  const args = process.argv.slice(2);
  const fileIndex = args.indexOf("--file");

  if (fileIndex < 0 || !args[fileIndex + 1]) {
    throw new Error(
      "Usage: npx tsx scripts/validate-ugc-institution-staging.ts --file <csv>"
    );
  }

  const file = resolve(args[fileIndex + 1]!);
  const raw = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");

  const rows = parseCsv(raw);

  const validationErrors: Array<{
    row: number;
    sourceRecordId: string;
    issues: string[];
  }> = [];

  rows.forEach((row, index) => {
    const issues: string[] = [];

    const required = [
      "staging_id",
      "source_id",
      "source_record_id",
      "canonical_name",
      "slug",
      "institution_category",
      "district_name",
      "district_code",
      "identity_source_url",
      "location_source_url",
      "location_review_action",
      "verification_status",
      "production_verified",
      "staging_package",
    ];

    for (const field of required) {
      if (!clean(row[field])) issues.push(`${field}: missing`);
    }

    if (row.source_id !== "source_ugc") {
      issues.push("source_id: must be source_ugc");
    }

    if (row.location_review_action !== "RECOMMEND_ACCEPT") {
      issues.push("location_review_action: must be RECOMMEND_ACCEPT");
    }

    if (row.verification_status !== "DRAFT") {
      issues.push("verification_status: must be DRAFT");
    }

    if (row.production_verified !== "NO") {
      issues.push("production_verified: must be NO");
    }

    if (row.staging_package !== "v6.3") {
      issues.push("staging_package: must be v6.3");
    }

    if (
      !row.identity_source_url?.startsWith("https://") ||
      !row.location_source_url?.startsWith("https://")
    ) {
      issues.push("source URLs must use HTTPS");
    }

    if (row.website_url && !row.website_url.startsWith("https://")) {
      issues.push("website_url must be blank or HTTPS");
    }

    if (issues.length) {
      validationErrors.push({
        row: index + 2,
        sourceRecordId: clean(row.source_record_id),
        issues,
      });
    }
  });

  const duplicateSourceRecordIds = duplicates(
    rows.map((r) => clean(r.source_record_id).toLowerCase())
  );

  const duplicateStagingIds = duplicates(
    rows.map((r) => clean(r.staging_id))
  );

  const duplicateSlugs = duplicates(
    rows.map((r) => clean(r.slug).toLowerCase())
  );

  const sourceUgc = await prisma.dataSource.findUnique({
    where: { id: "source_ugc" },
    select: {
      id: true,
      name: true,
    },
  });

  const requiredDistrictCodes = [
    ...new Set(rows.map((r) => clean(r.district_code)).filter(Boolean)),
  ];

  const databaseDistricts = await prisma.district.findMany({
    where: {
      code: {
        in: requiredDistrictCodes,
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
    },
  });

  const districtByCode = new Map(
    databaseDistricts.map((d) => [d.code, d])
  );

  const missingDistrictCodes = requiredDistrictCodes
    .filter((code) => !districtByCode.has(code))
    .sort();

  const districtNameMismatches = rows
    .filter((row) => {
      const db = districtByCode.get(clean(row.district_code));
      return (
        db &&
        clean(db.name).toLowerCase() !==
          clean(row.district_name).toLowerCase()
      );
    })
    .map((row) => ({
      sourceRecordId: row.source_record_id,
      districtCode: row.district_code,
      stagedName: row.district_name,
      databaseName: districtByCode.get(row.district_code)?.name,
    }));

  const stagedSourceRecordIds = rows.map((r) =>
    clean(r.source_record_id)
  );

  const existingSourceRecords = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: {
        in: stagedSourceRecordIds,
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

  const stagedSlugs = rows.map((r) => clean(r.slug));

  const existingSlugRows = await prisma.institution.findMany({
    where: {
      slug: {
        in: stagedSlugs,
      },
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

  const websiteNonHttps = rows
    .filter(
      (row) =>
        clean(row.website_url) &&
        !clean(row.website_url).startsWith("https://")
    )
    .map((row) => row.source_record_id);

  const checks = {
    expectedRows110: rows.length === 110,
    allRowsValidated: validationErrors.length === 0,
    sourceUgcRegistered: Boolean(sourceUgc),
    noDuplicateSourceRecordIds:
      duplicateSourceRecordIds.length === 0,
    noDuplicateStagingIds:
      duplicateStagingIds.length === 0,
    noDuplicateSlugs:
      duplicateSlugs.length === 0,
    allDistrictCodesResolve:
      missingDistrictCodes.length === 0,
    noDistrictNameMismatches:
      districtNameMismatches.length === 0,
    noExistingSourceRecordCollisions:
      existingSourceRecords.length === 0,
    noExistingSlugCollisions:
      existingSlugRows.length === 0,
    noNonHttpsWebsiteUrls:
      websiteNonHttps.length === 0,
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  const status =
    hardStopReasons.length === 0
      ? "READY_FOR_DRAFT_IMPORT_DESIGN"
      : "HARD_STOP";

  console.log(
    JSON.stringify(
      {
        status,
        mode: "READ_ONLY_VALIDATION",
        dbWritesPerformed: false,
        file,
        sha256,

        recordsRead: rows.length,
        recordsValidated:
          rows.length - validationErrors.length,
        validationErrors: validationErrors.length,

        sourceUgcRegistered: Boolean(sourceUgc),

        districtCodesRequired: requiredDistrictCodes.length,
        databaseDistrictMatches: databaseDistricts.length,
        missingDistrictCodes: missingDistrictCodes.length,
        districtNameMismatches:
          districtNameMismatches.length,

        databaseUgcParents:
          existingSourceRecords.length,
        existingSourceRecordCollisions:
          existingSourceRecords.length,
        existingSlugCollisions:
          existingSlugRows.length,

        duplicateSourceRecordIds:
          duplicateSourceRecordIds.length,
        duplicateStagingIds:
          duplicateStagingIds.length,
        duplicateSlugs:
          duplicateSlugs.length,

        websiteNonHttps:
          websiteNonHttps.length,

        verificationPolicy: {
          requiredInstitutionStatus: "DRAFT",
          requiredProductionVerified: "NO",
          verifiedPublicationAllowed: false,
        },

        checks,
        hardStopReasons,

        samples: {
          validationErrors:
            validationErrors.slice(0, 10),
          missingDistrictCodes:
            missingDistrictCodes.slice(0, 20),
          districtNameMismatches:
            districtNameMismatches.slice(0, 20),
          existingSourceRecordCollisions:
            existingSourceRecords.slice(0, 20),
          existingSlugCollisions:
            existingSlugRows.slice(0, 20),
          websiteNonHttps:
            websiteNonHttps.slice(0, 20),
        },
      },
      null,
      2
    )
  );

  if (status === "HARD_STOP") {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
