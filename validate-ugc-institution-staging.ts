import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parseCsv } from "../src/import/csv.js";

const prisma = new PrismaClient();

const args = process.argv.slice(2);

function valueAfter(flag: string) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const fileArg = valueAfter("--file");

if (!fileArg) {
  throw new Error(
    "Usage: npx tsx scripts/validate-ugc-institution-staging.ts --file <institution_draft_ready.csv>"
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

const rowSchema = z.object({
  staging_id: z.string().regex(/^stage:ugc-institution:v6\.3:[0-9a-f]{24}$/),
  source_id: z.literal("source_ugc"),
  source_record_id: z.string().regex(/^ugc:(?:public|private|international|cbhe):.+$/i),
  canonical_name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  institution_category: z.enum(["public", "private", "international", "cbhe"]),
  district_name: z.string().min(1),
  district_code: z.string().min(1),
  website_url: z.string(),
  identity_source_url: z.string().url().refine((v) => v.startsWith("https://")),
  location_source_url: z.string().url().refine((v) => v.startsWith("https://")),
  location_review_action: z.literal("RECOMMEND_ACCEPT"),
  location_review_note: z.string().min(1),
  verification_status: z.literal("DRAFT"),
  production_verified: z.literal("NO"),
  staging_package: z.literal("v6.3"),
});

async function main() {
  const file = resolve(fileArg!);
  const raw = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");

  const parsed = parseCsv(raw, { maxRows: 500 });

  const validationErrors: Array<{
    row: number;
    sourceRecordId: string;
    issues: string[];
  }> = [];

  const validRows: Array<z.infer<typeof rowSchema>> = [];

  for (let i = 0; i < parsed.records.length; i += 1) {
    const values = parsed.records[i]!.values as Record<string, string>;
    const result = rowSchema.safeParse(values);

    if (!result.success) {
      validationErrors.push({
        row: i + 2,
        sourceRecordId: clean(values.source_record_id),
        issues: result.error.issues.map((issue) =>
          `${issue.path.join(".")}: ${issue.message}`
        ),
      });
    } else {
      validRows.push(result.data);
    }
  }

  const sourceIds = validRows.map((r) => lower(r.source_record_id));
  const stagingIds = validRows.map((r) => r.staging_id);
  const slugs = validRows.map((r) => r.slug.toLowerCase());

  function duplicates(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
      .sort();
  }

  const duplicateSourceRecordIds = duplicates(sourceIds);
  const duplicateStagingIds = duplicates(stagingIds);
  const duplicateSlugs = duplicates(slugs);

  const source = await prisma.dataSource.findUnique({
    where: { id: "source_ugc" },
    select: {
      id: true,
      name: true,
      authority: true,
      baseUrl: true,
    },
  });

  const districtCodes = [...new Set(validRows.map((r) => r.district_code))];

  const districts = await prisma.district.findMany({
    where: {
      code: { in: districtCodes },
    },
    select: {
      id: true,
      code: true,
      name: true,
      slug: true,
      divisionId: true,
    },
  });

  const districtByCode = new Map(
    districts.map((d) => [d.code, d])
  );

  const missingDistrictCodes = districtCodes
    .filter((code) => !districtByCode.has(code))
    .sort();

  const districtNameMismatches = validRows
    .filter((row) => {
      const district = districtByCode.get(row.district_code);
      return district && lower(district.name) !== lower(row.district_name);
    })
    .map((row) => {
      const district = districtByCode.get(row.district_code)!;
      return {
        sourceRecordId: row.source_record_id,
        stagedDistrictCode: row.district_code,
        stagedDistrictName: row.district_name,
        databaseDistrictName: district.name,
      };
    });

  const existingUgcParents = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { not: null },
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

  const dbUgcBySourceRecordId = new Map<string, typeof existingUgcParents>();
  for (const row of existingUgcParents) {
    const key = lower(row.sourceRecordId);
    const list = dbUgcBySourceRecordId.get(key) ?? [];
    list.push(row);
    dbUgcBySourceRecordId.set(key, list);
  }

  const existingSourceRecordCollisions = validRows
    .filter((row) => (dbUgcBySourceRecordId.get(lower(row.source_record_id)) ?? []).length > 0)
    .map((row) => ({
      sourceRecordId: row.source_record_id,
      databaseMatches: (dbUgcBySourceRecordId.get(lower(row.source_record_id)) ?? []).map(
        (db) => ({
          id: db.id,
          name: db.name,
          slug: db.slug,
          district: db.district,
          districtId: db.districtId,
          verificationStatus: db.verificationStatus,
        })
      ),
    }));

  const existingSlugMatches = await prisma.institution.findMany({
    where: {
      slug: { in: [...new Set(validRows.map((r) => r.slug))] },
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

  const existingSlugCollisions = existingSlugMatches.map((db) => ({
    id: db.id,
    name: db.name,
    slug: db.slug,
    dataSourceId: db.dataSourceId,
    sourceRecordId: db.sourceRecordId,
    verificationStatus: db.verificationStatus,
  }));

  const websiteNonHttps = validRows
    .filter((r) => r.website_url && !r.website_url.startsWith("https://"))
    .map((r) => r.source_record_id);

  const hardStopReasons: string[] = [];

  const checks = {
    expectedRows110: parsed.records.length === 110,
    allRowsValidated: validRows.length === parsed.records.length,
    sourceUgcRegistered: Boolean(source),
    noDuplicateSourceRecordIds: duplicateSourceRecordIds.length === 0,
    noDuplicateStagingIds: duplicateStagingIds.length === 0,
    noDuplicateSlugs: duplicateSlugs.length === 0,
    allDistrictCodesResolve: missingDistrictCodes.length === 0,
    noDistrictNameMismatches: districtNameMismatches.length === 0,
    noExistingSourceRecordCollisions: existingSourceRecordCollisions.length === 0,
    noExistingSlugCollisions: existingSlugCollisions.length === 0,
    noNonHttpsWebsiteUrls: websiteNonHttps.length === 0,
  };

  for (const [key, passed] of Object.entries(checks)) {
    if (!passed) hardStopReasons.push(key);
  }

  const status =
    hardStopReasons.length === 0
      ? "READY_FOR_DRAFT_IMPORT_DESIGN"
      : "HARD_STOP";

  const report = {
    status,
    mode: "READ_ONLY_VALIDATION",
    dbWritesPerformed: false,
    file,
    sha256,
    stagingPackage: "v6.3",
    recordsRead: parsed.records.length,
    recordsValidated: validRows.length,
    validationErrors: validationErrors.length,
    sourceUgcRegistered: Boolean(source),
    sourceUgc: source,
    districtCodesRequired: districtCodes.length,
    databaseDistrictMatches: districts.length,
    missingDistrictCodes: missingDistrictCodes.length,
    districtNameMismatches: districtNameMismatches.length,
    databaseUgcParents: existingUgcParents.length,
    existingSourceRecordCollisions: existingSourceRecordCollisions.length,
    existingSlugCollisions: existingSlugCollisions.length,
    duplicateSourceRecordIds: duplicateSourceRecordIds.length,
    duplicateStagingIds: duplicateStagingIds.length,
    duplicateSlugs: duplicateSlugs.length,
    websiteNonHttps: websiteNonHttps.length,
    verificationPolicy: {
      requiredInstitutionStatus: "DRAFT",
      requiredProductionVerified: "NO",
      verifiedPublicationAllowed: false,
    },
    checks,
    hardStopReasons,
    samples: {
      validationErrors: validationErrors.slice(0, 10),
      missingDistrictCodes: missingDistrictCodes.slice(0, 20),
      districtNameMismatches: districtNameMismatches.slice(0, 20),
      existingSourceRecordCollisions: existingSourceRecordCollisions.slice(0, 20),
      existingSlugCollisions: existingSlugCollisions.slice(0, 20),
      websiteNonHttps: websiteNonHttps.slice(0, 20),
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (status === "HARD_STOP") {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
