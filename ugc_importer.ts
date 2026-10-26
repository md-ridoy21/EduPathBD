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

const APPROVAL_TOKEN = "I_APPROVE_108_DRAFT_AND_2_LINEAGE_BACKFILLS";

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

function has(flag: string) {
  return process.argv.includes(flag);
}

async function buildPayloads(insertRows: Row[]) {
  const districtCodes = [...new Set(insertRows.map((r) => clean(r.district_code)))];

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

  const errors: Array<{ sourceRecordId: string; issues: string[] }> = [];

  const payloads: Prisma.InstitutionCreateManyInput[] = insertRows.map((row) => {
    const issues: string[] = [];
    const category = lower(row.institution_category);
    const district = districtByCode.get(clean(row.district_code));

    let type: InstitutionType | undefined;
    let ownership: OwnershipType | undefined;

    if (category === "public") {
      type = InstitutionType.PUBLIC_UNIVERSITY;
      ownership = OwnershipType.PUBLIC;
    } else if (category === "private") {
      type = InstitutionType.PRIVATE_UNIVERSITY;
      ownership = OwnershipType.PRIVATE;
    } else {
      issues.push(`unsupported category: ${category || "<blank>"}`);
    }

    if (!district) {
      issues.push(`district not found: ${clean(row.district_code)}`);
    } else if (lower(district.name) !== lower(row.district_name)) {
      issues.push(
        `district mismatch staged=${clean(row.district_name)} db=${district.name}`
      );
    }

    if (clean(row.verification_status) !== "DRAFT") {
      issues.push("verification_status must be DRAFT");
    }

    if (clean(row.production_verified) !== "NO") {
      issues.push("production_verified must be NO");
    }

    if (clean(row.source_id) !== "source_ugc") {
      issues.push("source_id must be source_ugc");
    }

    if (!clean(row.source_record_id)) {
      issues.push("source_record_id missing");
    }

    if (issues.length) {
      errors.push({
        sourceRecordId: clean(row.source_record_id),
        issues,
      });
    }

    return {
      name: clean(row.canonical_name),
      slug: clean(row.slug),
      type: type!,
      ownership: ownership!,
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
      verificationStatus: VerificationStatus.DRAFT,
      sourceUrl: clean(row.identity_source_url),
      verifiedAt: null,
      sourceUpdatedAt: null,
    };
  });

  return { payloads, errors, districtCodes, districts };
}

async function main() {
  const insertFileArg = arg("--insert-file");
  const linkFileArg = arg("--link-file");
  const apply = has("--apply");
  const approvalToken = arg("--approval-token");

  if (!insertFileArg || !linkFileArg) {
    throw new Error(
      "Usage: npx tsx scripts/import-ugc-institutions-guarded.ts " +
      "--insert-file <csv> --link-file <csv> " +
      "[--apply --approval-token <token>]"
    );
  }

  const insertFile = resolve(insertFileArg);
  const linkFile = resolve(linkFileArg);

  const insertRows = parseCsv(await readFile(insertFile, "utf8"));
  const linkRows = parseCsv(await readFile(linkFile, "utf8"));

  if (insertRows.length !== 108) {
    throw new Error(`HARD STOP: expected 108 insert rows, found ${insertRows.length}`);
  }

  if (linkRows.length !== 2) {
    throw new Error(`HARD STOP: expected 2 lineage rows, found ${linkRows.length}`);
  }

  const { payloads, errors } = await buildPayloads(insertRows);

  if (errors.length) {
    console.log(JSON.stringify({
      status: "HARD_STOP",
      dbWritesPerformed: false,
      payloadErrors: errors,
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const expectedLinks = new Map([
    ["inst_du", "ugc:public:1"],
    ["inst_cu", "ugc:public:5"],
  ]);

  for (const row of linkRows) {
    const id = clean(row.existing_institution_id);
    const srid = clean(row.source_record_id);
    const expected = expectedLinks.get(id);

    if (!expected || expected !== srid) {
      throw new Error(`HARD STOP: unexpected lineage proposal ${id} -> ${srid}`);
    }

    if (clean(row.proposed_change) !== "BACKFILL_SOURCE_RECORD_ID_ONLY") {
      throw new Error(`HARD STOP: invalid proposed_change for ${id}`);
    }

    if (clean(row.human_approval_required) !== "YES") {
      throw new Error(`HARD STOP: human approval flag missing for ${id}`);
    }
  }

  const stagedSourceRecordIds = payloads.map((p) => clean(p.sourceRecordId));
  const stagedSlugs = payloads.map((p) => clean(p.slug));

  const preflightSourceCollisions = await prisma.institution.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: stagedSourceRecordIds },
    },
    select: { id: true, name: true, slug: true, sourceRecordId: true },
  });

  const preflightSlugCollisions = await prisma.institution.findMany({
    where: { slug: { in: stagedSlugs } },
    select: {
      id: true,
      name: true,
      slug: true,
      dataSourceId: true,
      sourceRecordId: true,
    },
  });

  const linkTargets = await prisma.institution.findMany({
    where: { id: { in: ["inst_du", "inst_cu"] } },
    select: {
      id: true,
      name: true,
      slug: true,
      dataSourceId: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const linkTargetById = new Map(linkTargets.map((r) => [r.id, r]));
  const linkPreflightIssues: string[] = [];

  for (const [id, srid] of expectedLinks) {
    const target = linkTargetById.get(id);

    if (!target) {
      linkPreflightIssues.push(`${id}: target missing`);
      continue;
    }

    if (target.dataSourceId !== "source_ugc") {
      linkPreflightIssues.push(`${id}: dataSourceId is not source_ugc`);
    }

    if (target.sourceRecordId !== null) {
      linkPreflightIssues.push(`${id}: sourceRecordId already non-null`);
    }

    if (target.verificationStatus !== VerificationStatus.VERIFIED) {
      linkPreflightIssues.push(`${id}: verificationStatus is not VERIFIED`);
    }

    const reused = await prisma.institution.findFirst({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: srid,
      },
      select: { id: true },
    });

    if (reused) {
      linkPreflightIssues.push(`${id}: ${srid} already used by ${reused.id}`);
    }
  }

  const preflightClean =
    preflightSourceCollisions.length === 0 &&
    preflightSlugCollisions.length === 0 &&
    linkPreflightIssues.length === 0;

  if (!apply) {
    console.log(JSON.stringify({
      status: preflightClean
        ? "DRY_RUN_READY_FOR_EXPLICIT_HUMAN_APPROVAL"
        : "HARD_STOP",
      mode: "DRY_RUN_ONLY",
      dbWritesPerformed: false,
      insertRows: payloads.length,
      lineageRows: linkRows.length,
      preflightSourceCollisions: preflightSourceCollisions.length,
      preflightSlugCollisions: preflightSlugCollisions.length,
      lineagePreflightIssues: linkPreflightIssues.length,
      requiredApprovalToken: APPROVAL_TOKEN,
      policy: {
        newRowsVerificationStatus: "DRAFT",
        existingVerifiedRowsPreserved: true,
        lineageUpdatesOnlySourceRecordId: true,
        transactionRequired: true,
        verifiedPublicationAllowed: false,
      },
      samples: {
        sourceCollisions: preflightSourceCollisions.slice(0, 10),
        slugCollisions: preflightSlugCollisions.slice(0, 10),
        lineageIssues: linkPreflightIssues,
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
    const sourceCollisions = await tx.institution.findMany({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: { in: stagedSourceRecordIds },
      },
      select: { id: true },
    });

    if (sourceCollisions.length) {
      throw new Error("TRANSACTION ABORT: sourceRecordId collision appeared");
    }

    const slugCollisions = await tx.institution.findMany({
      where: { slug: { in: stagedSlugs } },
      select: { id: true },
    });

    if (slugCollisions.length) {
      throw new Error("TRANSACTION ABORT: slug collision appeared");
    }

    for (const [id, srid] of expectedLinks) {
      const target = await tx.institution.findUnique({
        where: { id },
        select: {
          id: true,
          dataSourceId: true,
          sourceRecordId: true,
          verificationStatus: true,
        },
      });

      if (
        !target ||
        target.dataSourceId !== "source_ugc" ||
        target.sourceRecordId !== null ||
        target.verificationStatus !== VerificationStatus.VERIFIED
      ) {
        throw new Error(`TRANSACTION ABORT: lineage target changed: ${id}`);
      }

      const reused = await tx.institution.findFirst({
        where: {
          dataSourceId: "source_ugc",
          sourceRecordId: srid,
        },
        select: { id: true },
      });

      if (reused) {
        throw new Error(`TRANSACTION ABORT: ${srid} already used`);
      }
    }

    const created = await tx.institution.createMany({
      data: payloads,
      skipDuplicates: false,
    });

    if (created.count !== 108) {
      throw new Error(
        `TRANSACTION ABORT: expected 108 inserts, got ${created.count}`
      );
    }

    const du = await tx.institution.update({
      where: { id: "inst_du" },
      data: { sourceRecordId: "ugc:public:1" },
      select: {
        id: true,
        sourceRecordId: true,
        verificationStatus: true,
      },
    });

    const cu = await tx.institution.update({
      where: { id: "inst_cu" },
      data: { sourceRecordId: "ugc:public:5" },
      select: {
        id: true,
        sourceRecordId: true,
        verificationStatus: true,
      },
    });

    if (
      du.verificationStatus !== VerificationStatus.VERIFIED ||
      cu.verificationStatus !== VerificationStatus.VERIFIED
    ) {
      throw new Error("TRANSACTION ABORT: VERIFIED status changed unexpectedly");
    }

    const draftCount = await tx.institution.count({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: { in: stagedSourceRecordIds },
        verificationStatus: VerificationStatus.DRAFT,
      },
    });

    if (draftCount !== 108) {
      throw new Error(
        `TRANSACTION ABORT: expected 108 DRAFT imported rows, got ${draftCount}`
      );
    }

    return {
      insertedDraftRows: created.count,
      lineageBackfills: [
        { id: du.id, sourceRecordId: du.sourceRecordId, verificationStatus: du.verificationStatus },
        { id: cu.id, sourceRecordId: cu.sourceRecordId, verificationStatus: cu.verificationStatus },
      ],
      importedDraftCountVerifiedInsideTransaction: draftCount,
    };
  });

  console.log(JSON.stringify({
    status: "APPLY_SUCCESS",
    mode: "EXPLICIT_HUMAN_APPROVED_TRANSACTION",
    dbWritesPerformed: true,
    result,
    policyAssertions: {
      insertedRowsAreDraft: true,
      existingVerifiedRowsPreserved: true,
      lineageChangeScope: "sourceRecordId only",
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
