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

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const fileArg = arg("--file");

  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/dry-run-ugc-institution-import.ts --file <institution_new_draft_insert_candidates.csv>"
    );
  }

  const file = resolve(fileArg);
  const rows = parseCsv(await readFile(file, "utf8"));

  const categoryCounts: Record<string, number> = {};
  for (const row of rows) {
    const category = lower(row.institution_category);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }

  const unexpectedCategories = Object.keys(categoryCounts)
    .filter((c) => !["public", "private"].includes(c))
    .sort();

  const districtCodes = [...new Set(rows.map((r) => clean(r.district_code)))];

  const districts = await prisma.district.findMany({
    where: { code: { in: districtCodes } },
    select: {
      id: true,
      code: true,
      name: true,
      divisionId: true,
    },
  });

  const districtByCode = new Map(districts.map((d) => [d.code, d]));

  const payloadErrors: Array<{
    sourceRecordId: string;
    issues: string[];
  }> = [];

  const payloads = rows.map((row) => {
    const issues: string[] = [];
    const category = lower(row.institution_category);
    const district = districtByCode.get(clean(row.district_code));

    let type: "PUBLIC_UNIVERSITY" | "PRIVATE_UNIVERSITY" | undefined;
    let ownership: "PUBLIC" | "PRIVATE" | undefined;

    if (category === "public") {
      type = "PUBLIC_UNIVERSITY";
      ownership = "PUBLIC";
    } else if (category === "private") {
      type = "PRIVATE_UNIVERSITY";
      ownership = "PRIVATE";
    } else {
      issues.push(`unsupported institution_category: ${category || "<blank>"}`);
    }

    if (!district) {
      issues.push(`district code not found: ${clean(row.district_code)}`);
    } else if (lower(district.name) !== lower(row.district_name)) {
      issues.push(
        `district mismatch: staged=${row.district_name}, db=${district.name}`
      );
    }

    if (clean(row.verification_status) !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }

    if (clean(row.production_verified) !== "NO") {
      issues.push("production_verified must be NO");
    }

    if (issues.length) {
      payloadErrors.push({
        sourceRecordId: clean(row.source_record_id),
        issues,
      });
    }

    return {
      name: clean(row.canonical_name),
      slug: clean(row.slug),
      type,
      ownership,
      officialCode: null,
      divisionId: district?.divisionId ?? null,
      districtId: district?.id ?? null,
      upazilaId: null,
      localityType: null,
      localityName: null,
      dataSourceId: "source_ugc",
      sourceRecordId: clean(row.source_record_id),
      description: null,
      district: clean(row.district_name),
      address: null,
      latitude: null,
      longitude: null,
      websiteUrl: clean(row.website_url) || null,
      logoUrl: null,
      establishedYear: null,
      verificationStatus: "DRAFT",
      sourceUrl: clean(row.identity_source_url),
      verifiedAt: null,
      sourceUpdatedAt: null,
    };
  });

  const existingBySource = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: {
        in: rows.map((r) => clean(r.source_record_id)),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sourceRecordId: true,
    },
  });

  const existingBySlug = await prisma.institution.findMany({
    where: {
      slug: {
        in: rows.map((r) => clean(r.slug)),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      dataSourceId: true,
      sourceRecordId: true,
    },
  });

  const checks = {
    expectedRows108: rows.length === 108,
    onlySupportedCategories: unexpectedCategories.length === 0,
    allDistrictsResolve: districts.length === districtCodes.length,
    payloadErrorsZero: payloadErrors.length === 0,
    noExistingSourceRecordCollisions: existingBySource.length === 0,
    noExistingSlugCollisions: existingBySlug.length === 0,
    allPayloadsDraft: payloads.every((p) => p.verificationStatus === "DRAFT"),
    allPayloadsSourceUgc: payloads.every((p) => p.dataSourceId === "source_ugc"),
    allPayloadsHaveSourceRecordId: payloads.every((p) => Boolean(p.sourceRecordId)),
    allPayloadsHaveDistrictId: payloads.every((p) => Boolean(p.districtId)),
    noVerifiedWritesPlanned: payloads.every((p) => p.verifiedAt === null),
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  const status =
    hardStopReasons.length === 0
      ? "READY_FOR_HUMAN_APPROVAL_TO_IMPLEMENT_WRITE_IMPORTER"
      : "HARD_STOP";

  console.log(JSON.stringify({
    status,
    mode: "READ_ONLY_IMPORT_PAYLOAD_DRY_RUN",
    dbWritesPerformed: false,
    file,
    rowsRead: rows.length,
    categoryCounts,
    unexpectedCategories,
    districtCodesRequired: districtCodes.length,
    databaseDistrictMatches: districts.length,
    payloadsBuilt: payloads.length,
    payloadErrors: payloadErrors.length,
    existingSourceRecordCollisions: existingBySource.length,
    existingSlugCollisions: existingBySlug.length,
    mappingPolicy: {
      public: {
        type: "PUBLIC_UNIVERSITY",
        ownership: "PUBLIC",
      },
      private: {
        type: "PRIVATE_UNIVERSITY",
        ownership: "PRIVATE",
      },
      verificationStatus: "DRAFT",
      dataSourceId: "source_ugc",
      sourceUrl: "identity_source_url",
      websiteUrl: "website_url or null",
      districtId: "resolved from district_code",
      divisionId: "resolved from District.divisionId",
      omittedOrNullFields: [
        "officialCode",
        "upazilaId",
        "localityType",
        "localityName",
        "description",
        "address",
        "latitude",
        "longitude",
        "logoUrl",
        "establishedYear",
        "verifiedAt",
        "sourceUpdatedAt"
      ]
    },
    checks,
    hardStopReasons,
    samples: {
      payloadErrors: payloadErrors.slice(0, 10),
      existingSourceRecordCollisions: existingBySource.slice(0, 10),
      existingSlugCollisions: existingBySlug.slice(0, 10),
      payloads: payloads.slice(0, 3),
    }
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
