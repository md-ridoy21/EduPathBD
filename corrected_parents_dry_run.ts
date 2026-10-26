import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { InstitutionType, OwnershipType, PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

function clean(v: unknown): string {
  return String(v ?? "").trim();
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
      "Usage: npx tsx scripts/dry-run-corrected-ugc-parents.ts --file <corrected_parent_draft_ready.csv>"
    );
  }

  const file = resolve(fileArg);
  const rows = parseCsv(await readFile(file, "utf8"));

  const expectedIds = new Set(["ugc:private:58", "ugc:private:80"]);
  const seenIds = rows.map((r) => clean(r.source_record_id));

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

  const payloadErrors: Array<{ sourceRecordId: string; issues: string[] }> = [];

  const payloads = rows.map((row) => {
    const issues: string[] = [];
    const district = districtByCode.get(clean(row.district_code));

    if (!expectedIds.has(clean(row.source_record_id))) {
      issues.push("unexpected source_record_id");
    }

    if (clean(row.source_id) !== "source_ugc") {
      issues.push("source_id must be source_ugc");
    }

    if (clean(row.institution_category) !== "private") {
      issues.push("institution_category must be private");
    }

    if (clean(row.verification_status) !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }

    if (clean(row.production_verified) !== "NO") {
      issues.push("production_verified must be NO");
    }

    if (!district) {
      issues.push(`district code not found: ${clean(row.district_code)}`);
    } else if (district.name.toLowerCase() !== clean(row.district_name).toLowerCase()) {
      issues.push(`district mismatch staged=${clean(row.district_name)} db=${district.name}`);
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
      type: InstitutionType.PRIVATE_UNIVERSITY,
      ownership: OwnershipType.PRIVATE,
      divisionId: district?.divisionId ?? null,
      districtId: district?.id ?? null,
      dataSourceId: "source_ugc",
      sourceRecordId: clean(row.source_record_id),
      district: clean(row.district_name),
      websiteUrl: null,
      verificationStatus: VerificationStatus.DRAFT,
      sourceUrl: clean(row.identity_source_url),
      verifiedAt: null,
    };
  });

  const existingBySource = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: seenIds },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const existingBySlug = await prisma.institution.findMany({
    where: {
      slug: { in: rows.map((r) => clean(r.slug)) },
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

  const checks = {
    expectedRows2: rows.length === 2,
    exactExpectedSourceRecordIds:
      seenIds.length === 2 &&
      seenIds.every((id) => expectedIds.has(id)) &&
      new Set(seenIds).size === 2,
    districtsResolve: districts.length === districtCodes.length,
    payloadErrorsZero: payloadErrors.length === 0,
    noExistingSourceRecordCollisions: existingBySource.length === 0,
    noExistingSlugCollisions: existingBySlug.length === 0,
    allPayloadsDraft: payloads.every((p) => p.verificationStatus === VerificationStatus.DRAFT),
    allPayloadsPrivateUniversity: payloads.every((p) => p.type === InstitutionType.PRIVATE_UNIVERSITY),
    noVerifiedWritesPlanned: payloads.every((p) => p.verifiedAt === null),
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  console.log(JSON.stringify({
    status:
      hardStopReasons.length === 0
        ? "READY_FOR_EXPLICIT_HUMAN_APPROVAL"
        : "HARD_STOP",
    mode: "READ_ONLY_CORRECTED_PARENT_DRY_RUN",
    dbWritesPerformed: false,
    file,
    rowsRead: rows.length,
    recordsValidated: rows.length - payloadErrors.length,
    payloadErrors: payloadErrors.length,
    districtCodesRequired: districtCodes.length,
    databaseDistrictMatches: districts.length,
    existingSourceRecordCollisions: existingBySource.length,
    existingSlugCollisions: existingBySlug.length,
    checks,
    hardStopReasons,
    samples: {
      payloadErrors,
      existingBySource,
      existingBySlug,
      payloads,
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
