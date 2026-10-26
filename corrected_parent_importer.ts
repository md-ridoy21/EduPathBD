import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  InstitutionType,
  OwnershipType,
  Prisma,
  PrismaClient,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

const APPROVAL_TOKEN = "I_APPROVE_2_CORRECTED_UGC_PARENT_DRAFT_INSERTS";

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

function has(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const fileArg = arg("--file");
  const apply = has("--apply");
  const approvalToken = arg("--approval-token");

  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/import-corrected-ugc-parents-guarded.ts " +
      "--file <corrected_parent_draft_ready.csv> " +
      "[--apply --approval-token <token>]"
    );
  }

  const file = resolve(fileArg);
  const rows = parseCsv(await readFile(file, "utf8"));

  const expected = new Map([
    ["ugc:private:58", { districtCode: "BD-KIS", districtName: "Kishoreganj" }],
    ["ugc:private:80", { districtCode: "BD-NIL", districtName: "Nilphamari" }],
  ]);

  if (rows.length !== 2) {
    throw new Error(`HARD STOP: expected 2 rows, found ${rows.length}`);
  }

  for (const row of rows) {
    const srid = clean(row.source_record_id);
    const exp = expected.get(srid);

    if (!exp) throw new Error(`HARD STOP: unexpected sourceRecordId ${srid}`);
    if (clean(row.source_id) !== "source_ugc") {
      throw new Error(`HARD STOP: ${srid} source_id is not source_ugc`);
    }
    if (clean(row.verification_status) !== "DRAFT") {
      throw new Error(`HARD STOP: ${srid} is not DRAFT`);
    }
    if (clean(row.production_verified) !== "NO") {
      throw new Error(`HARD STOP: ${srid} production_verified is not NO`);
    }
    if (clean(row.district_code) !== exp.districtCode) {
      throw new Error(`HARD STOP: ${srid} district code mismatch`);
    }
    if (clean(row.district_name) !== exp.districtName) {
      throw new Error(`HARD STOP: ${srid} district name mismatch`);
    }
  }

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

  if (districts.length !== districtCodes.length) {
    throw new Error("HARD STOP: one or more district codes do not resolve");
  }

  const payloads: Prisma.InstitutionCreateManyInput[] = rows.map((row) => {
    const district = districtByCode.get(clean(row.district_code));
    if (!district) {
      throw new Error(`HARD STOP: missing district ${clean(row.district_code)}`);
    }

    if (district.name.toLowerCase() !== clean(row.district_name).toLowerCase()) {
      throw new Error(
        `HARD STOP: district mismatch ${clean(row.district_name)} vs ${district.name}`
      );
    }

    return {
      name: clean(row.canonical_name),
      slug: clean(row.slug),
      type: InstitutionType.PRIVATE_UNIVERSITY,
      ownership: OwnershipType.PRIVATE,
      officialCode: null,
      divisionId: district.divisionId,
      districtId: district.id,
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
      websiteUrl: null,
      logoUrl: null,
      establishedYear: null,
      verificationStatus: VerificationStatus.DRAFT,
      sourceUrl: clean(row.identity_source_url),
      verifiedAt: null,
      sourceUpdatedAt: null,
    };
  });

  const sourceIds = payloads.map((p) => String(p.sourceRecordId));
  const slugs = payloads.map((p) => String(p.slug));

  const sourceCollisions = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: sourceIds },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const slugCollisions = await prisma.institution.findMany({
    where: {
      slug: { in: slugs },
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

  const preflightClean =
    sourceCollisions.length === 0 &&
    slugCollisions.length === 0;

  if (!apply) {
    console.log(JSON.stringify({
      status: preflightClean
        ? "DRY_RUN_READY_FOR_EXPLICIT_HUMAN_APPROVAL"
        : "HARD_STOP",
      mode: "DRY_RUN_ONLY",
      dbWritesPerformed: false,
      rows: payloads.length,
      sourceRecordCollisions: sourceCollisions.length,
      slugCollisions: slugCollisions.length,
      requiredApprovalToken: APPROVAL_TOKEN,
      policy: {
        verificationStatus: "DRAFT",
        productionVerified: "NO",
        verifiedPublicationAllowed: false,
        transactionRequired: true,
      },
      samples: {
        sourceCollisions,
        slugCollisions,
        payloads,
      },
    }, null, 2));

    if (!preflightClean) process.exitCode = 2;
    return;
  }

  if (approvalToken !== APPROVAL_TOKEN) {
    throw new Error(
      "HARD STOP: --apply requires exact --approval-token " + APPROVAL_TOKEN
    );
  }

  if (!preflightClean) {
    throw new Error("HARD STOP: preflight is not clean");
  }

  const result = await prisma.$transaction(async (tx) => {
    const txSourceCollisions = await tx.institution.findMany({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: { in: sourceIds },
      },
      select: { id: true },
    });

    if (txSourceCollisions.length) {
      throw new Error("TRANSACTION ABORT: sourceRecordId collision appeared");
    }

    const txSlugCollisions = await tx.institution.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });

    if (txSlugCollisions.length) {
      throw new Error("TRANSACTION ABORT: slug collision appeared");
    }

    const created = await tx.institution.createMany({
      data: payloads,
      skipDuplicates: false,
    });

    if (created.count !== 2) {
      throw new Error(
        `TRANSACTION ABORT: expected 2 inserts, got ${created.count}`
      );
    }

    const verification = await tx.institution.findMany({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: { in: sourceIds },
      },
      select: {
        id: true,
        name: true,
        sourceRecordId: true,
        district: true,
        districtId: true,
        verificationStatus: true,
      },
      orderBy: { sourceRecordId: "asc" },
    });

    if (
      verification.length !== 2 ||
      verification.some((r) => r.verificationStatus !== VerificationStatus.DRAFT)
    ) {
      throw new Error("TRANSACTION ABORT: inserted rows are not exactly 2 DRAFT rows");
    }

    return {
      insertedDraftRows: created.count,
      verification,
    };
  });

  console.log(JSON.stringify({
    status: "APPLY_SUCCESS",
    mode: "EXPLICIT_HUMAN_APPROVED_TRANSACTION",
    dbWritesPerformed: true,
    result,
    policyAssertions: {
      insertedRowsAreDraft: true,
      verifiedPublicationPerformed: false,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
