import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  CsvImportError,
  parseCsv
} from "../src/import/csv.js";

const prisma = new PrismaClient();

const args = process.argv.slice(2);

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const fileArg = valueAfter("--file");

if (!fileArg) {
  throw new Error(
    "Usage: npx tsx scripts/validate-ugc-program-staging.ts --file <program_draft_ready.csv>"
  );
}

const requiredHeaders = [
  "staging_id",
  "parent_source_record_id",
  "parent_authority_code",
  "parent_category",
  "institution_name",
  "institution_identity_source_url",
  "program_name",
  "program_slug",
  "degree_level",
  "degree_award",
  "candidate_count",
  "candidate_ids",
  "program_source_url",
  "all_program_source_urls",
  "verification_status",
  "production_verified",
  "staging_package",
  "notes"
] as const;

const httpsUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("https://"),
    "must use HTTPS"
  );

const rowSchema = z.object({
  staging_id: z
    .string()
    .regex(
      /^stage:ugc-program:v6\.3:[a-f0-9]{24}$/,
      "invalid staging ID"
    ),

  parent_source_record_id: z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => value.toLowerCase().startsWith("ugc:"),
      "parent must use canonical UGC source-record ID"
    ),

  parent_authority_code: z.string().trim().max(100),

  parent_category: z
    .enum([
      "private",
      "public",
      "international",
      "cbhe"
    ]),

  institution_name: z.string().trim().min(2).max(250),

  institution_identity_source_url: httpsUrl,

  program_name: z.string().trim().min(2).max(300),

  program_slug: z
    .string()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "invalid program slug"
    ),

  degree_level: z.enum([
    "UNDERGRADUATE",
    "POSTGRADUATE",
    "CERTIFICATE",
    "DIPLOMA",
    "DOCTORAL"
  ]),

  degree_award: z.string().trim().min(1).max(100),

  candidate_count: z.coerce.number().int().positive(),

  candidate_ids: z.string().trim().min(1),

  program_source_url: httpsUrl,

  all_program_source_urls: z.string().trim().min(1),

  verification_status: z.literal("DRAFT"),

  production_verified: z.literal("NO"),

  staging_package: z.literal("v6.3"),

  notes: z.string().trim().min(1).max(1000)
});

function normalizeId(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}

async function main() {
  const file = resolve(fileArg!);

  const info = await stat(file);

  if (!info.isFile()) {
    throw new Error("Staging input is not a file.");
  }

  if (info.size > 50 * 1024 * 1024) {
    throw new Error(
      "Staging CSV must be smaller than 50 MB."
    );
  }

  const input = await readFile(file, "utf8");

  const sha256 = createHash("sha256")
    .update(input)
    .digest("hex");

  const parsed = parseCsv(
    input,
    { maxRows: 10_000 }
  );

  const missingHeaders = requiredHeaders.filter(
    (header) => !parsed.headers.includes(header)
  );

  const unsupportedHeaders = parsed.headers.filter(
    (header) =>
      !requiredHeaders.includes(
        header as typeof requiredHeaders[number]
      )
  );

  if (
    missingHeaders.length ||
    unsupportedHeaders.length
  ) {
    throw new CsvImportError(
      [
        "Invalid staging columns.",
        `Missing: ${
          missingHeaders.join(", ") || "none"
        }.`,
        `Unsupported: ${
          unsupportedHeaders.join(", ") || "none"
        }.`
      ].join(" ")
    );
  }

  const validationErrors: Array<{
    row: number;
    message: string;
  }> = [];

  const validated: Array<{
    row: number;
    value: z.infer<typeof rowSchema>;
  }> = [];

  for (const record of parsed.records) {
    const result = rowSchema.safeParse(
      record.values
    );

    if (!result.success) {
      validationErrors.push({
        row: record.row,
        message: result.error.issues
          .map(
            (issue) =>
              `${
                issue.path.join(".")
              }: ${issue.message}`
          )
          .join("; ")
      });

      continue;
    }

    const additionalUrls =
      result.data.all_program_source_urls
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);

    if (
      additionalUrls.some(
        (url) => !url.startsWith("https://")
      )
    ) {
      validationErrors.push({
        row: record.row,
        message:
          "all_program_source_urls contains non-HTTPS URL"
      });

      continue;
    }

    validated.push({
      row: record.row,
      value: result.data
    });
  }

  const stagingIds = validated.map(
    (item) => item.value.staging_id
  );

  const duplicateStagingIds =
    duplicateValues(stagingIds);

  const parentSlugKeys = validated.map(
    (item) =>
      `${
        normalizeId(
          item.value.parent_source_record_id
        )
      }::${
        item.value.program_slug
      }`
  );

  const duplicateParentSlug =
    duplicateValues(parentSlugKeys);

  const parentIds = [
    ...new Set(
      validated.map((item) =>
        normalizeId(
          item.value.parent_source_record_id
        )
      )
    )
  ];

  const source = await prisma.dataSource.findUnique({
    where: {
      id: "source_ugc"
    },
    select: {
      id: true,
      authority: true,
      baseUrl: true
    }
  });

  if (!source) {
    throw new Error(
      "source_ugc is not registered in DataSource."
    );
  }

  /*
   * Read all UGC-parent institutions and normalize
   * sourceRecordId in memory. This deliberately avoids
   * numeric authority_code lookup because those codes
   * collide across public/private categories.
   */
  const databaseParents =
    await prisma.institution.findMany({
      where: {
        dataSourceId: source.id,
        sourceRecordId: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        sourceRecordId: true,
        district: true,
        districtId: true,
        verificationStatus: true
      }
    });

  const dbByCanonicalId = new Map<
    string,
    typeof databaseParents
  >();

  for (const parent of databaseParents) {
    if (!parent.sourceRecordId) continue;

    const key = normalizeId(
      parent.sourceRecordId
    );

    const existing =
      dbByCanonicalId.get(key) ?? [];

    existing.push(parent);

    dbByCanonicalId.set(key, existing);
  }

  const ambiguousParents = [
    ...dbByCanonicalId.entries()
  ]
    .filter(([, matches]) => matches.length > 1)
    .map(([canonicalId, matches]) => ({
      canonicalId,
      databaseIds: matches.map(
        (item) => item.id
      )
    }));

  const missingParents: string[] = [];
  const parentsWithoutLocation: Array<{
    canonicalId: string;
    databaseId: string;
    name: string;
    district: string;
    districtId: string | null;
  }> = [];

  const parentNameMismatches: Array<{
    canonicalId: string;
    stagingName: string;
    databaseName: string;
  }> = [];

  const stagingParentNames = new Map<
    string,
    string
  >();

  for (const item of validated) {
    const key = normalizeId(
      item.value.parent_source_record_id
    );

    const previous =
      stagingParentNames.get(key);

    if (
      previous &&
      normalizeName(previous) !==
        normalizeName(
          item.value.institution_name
        )
    ) {
      validationErrors.push({
        row: item.row,
        message:
          `Inconsistent institution_name for ${key}`
      });
    } else {
      stagingParentNames.set(
        key,
        item.value.institution_name
      );
    }
  }

  for (const canonicalId of parentIds) {
    const matches =
      dbByCanonicalId.get(canonicalId) ?? [];

    if (matches.length === 0) {
      missingParents.push(canonicalId);
      continue;
    }

    if (matches.length !== 1) {
      continue;
    }

    const parent = matches[0]!;

    if (
      !parent.district.trim() ||
      !parent.districtId
    ) {
      parentsWithoutLocation.push({
        canonicalId,
        databaseId: parent.id,
        name: parent.name,
        district: parent.district,
        districtId: parent.districtId
      });
    }

    const stagingName =
      stagingParentNames.get(canonicalId);

    if (
      stagingName &&
      normalizeName(stagingName) !==
        normalizeName(parent.name)
    ) {
      parentNameMismatches.push({
        canonicalId,
        stagingName,
        databaseName: parent.name
      });
    }
  }

  const hardStop =
    validationErrors.length > 0 ||
    duplicateStagingIds.length > 0 ||
    duplicateParentSlug.length > 0 ||
    ambiguousParents.length > 0 ||
    missingParents.length > 0 ||
    parentsWithoutLocation.length > 0 ||
    parentNameMismatches.length > 0;

  const report = {
    status: hardStop
      ? "HARD_STOP"
      : "READY_FOR_DRAFT_IMPORT_DESIGN",

    mode: "READ_ONLY_VALIDATION",

    dbWritesPerformed: false,

    file,
    sha256,

    recordsRead: parsed.records.length,
    recordsValidated: validated.length,

    stagingPackage: "v6.3",
    sourceId: source.id,

    canonicalParentJoin:
      "source_ugc + case-insensitive sourceRecordId",

    authorityCodeUsage:
      "REFERENCE_ONLY_NOT_JOIN_KEY",

    validationErrors:
      validationErrors.length,

    duplicateStagingIds:
      duplicateStagingIds.length,

    duplicateParentSlug:
      duplicateParentSlug.length,

    requiredParentIds:
      parentIds.length,

    databaseUgcParents:
      databaseParents.length,

    missingParents:
      missingParents.length,

    ambiguousParents:
      ambiguousParents.length,

    parentsWithoutLocation:
      parentsWithoutLocation.length,

    parentNameMismatches:
      parentNameMismatches.length,

    verificationPolicy: {
      requiredProgramStatus: "DRAFT",
      requiredProductionVerified: "NO",
      verifiedPublicationAllowed: false
    },

    samples: {
      validationErrors:
        validationErrors.slice(0, 20),

      duplicateStagingIds:
        duplicateStagingIds.slice(0, 20),

      duplicateParentSlug:
        duplicateParentSlug.slice(0, 20),

      missingParents:
        missingParents.slice(0, 30),

      ambiguousParents:
        ambiguousParents.slice(0, 20),

      parentsWithoutLocation:
        parentsWithoutLocation.slice(0, 30),

      parentNameMismatches:
        parentNameMismatches.slice(0, 30)
    }
  };

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  if (hardStop) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : String(error)
    );

    process.exitCode = 1;
  })
  .finally(
    () => prisma.$disconnect()
  );
