import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PrismaClient,
  PathwayCategory,
  VerificationStatus
} from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string, string>;

const APPROVAL_TOKEN = "I_APPROVE_STRICT_VERIFIED_UGC_PROGRAM_DRAFT_IMPORT";

function clean(v: unknown): string { return String(v ?? "").trim(); }
function lower(v: unknown): string { return clean(v).toLowerCase(); }

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0]!.map(h => h.trim());
  return rows.slice(1).filter(r => r.some(v => v.trim())).map(r => {
    const out: Row = {};
    headers.forEach((h, i) => out[h] = (r[i] ?? "").trim());
    return out;
  });
}

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(flag: string) { return process.argv.includes(flag); }

function canonicalProgramSourceRecordId(parentSourceRecordId: string, programSlug: string) {
  const identity = `${lower(parentSourceRecordId)}|${lower(programSlug)}`;
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `ugc:program:${hash}`;
}

function duplicateKeys(values: string[]) {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].filter(([,n]) => n > 1).map(([v]) => v);
}

const FORBIDDEN_SEMANTIC = [
  /\bread more\b/i, /\bhereby\b/i, /\badmission open\b/i, /\bonline application\b/i,
  /\bapplication form\b/i, /\bapply for\b/i, /\btuition fee\b/i, /\bfee structure\b/i,
  /\bscholarship\b/i, /\bwaiver\b/i, /\bfinal exam\b/i, /\bmarksheet\b/i,
  /\bmark sheet\b/i, /\btranscript\b/i, /\bbirth certificate\b/i,
  /\bnational id\b/i, /\bverification service\b/i
];

async function main() {
  const fileArg = arg("--file");
  const apply = has("--apply");
  const token = arg("--approval-token") ?? "";

  if (!fileArg) throw new Error("Usage: npx tsx scripts/import-ugc-programs-guarded.ts --file <verified-pass.csv> [--apply --approval-token TOKEN]");
  if (apply && token !== APPROVAL_TOKEN) throw new Error("HARD_STOP: missing or invalid explicit approval token");

  const file = resolve(fileArg);
  const raw = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(raw).digest("hex");
  const rows = parseCsv(raw);
  if (!rows.length) throw new Error("HARD_STOP: verified-pass CSV has zero rows");

  const parentIds = [...new Set(rows.map(r => lower(r.parent_source_record_id)))];
  const parents = await prisma.institution.findMany({
    where: { dataSourceId: "source_ugc", sourceRecordId: { in: parentIds } },
    select: { id: true, name: true, sourceRecordId: true, district: true, districtId: true }
  });

  const parentMap = new Map(parents.map(p => [lower(p.sourceRecordId), p] as const));
  const issues: Array<{stagingId: string; issues: string[]}> = [];
  const payloads = rows.map(row => {
    const rowIssues: string[] = [];
    const parent = parentMap.get(lower(row.parent_source_record_id));
    const name = clean(row.program_name);
    const slug = clean(row.program_slug);

    if (!parent) rowIssues.push("PARENT_NOT_FOUND");
    if (clean(row.source_verification_status) !== "PASS_STRONG") rowIssues.push("SOURCE_NOT_PASS_STRONG");
    if (clean(row.strict_semantic_status) !== "PASS") rowIssues.push("SEMANTIC_NOT_PASS");
    if (clean(row.verification_status) !== "DRAFT") rowIssues.push("STAGING_NOT_DRAFT");
    if (clean(row.production_verified) !== "NO") rowIssues.push("PRODUCTION_VERIFIED_NOT_NO");
    if (!clean(row.program_source_url).startsWith("https://")) rowIssues.push("SOURCE_NOT_HTTPS");
    if (!name || !slug) rowIssues.push("NAME_OR_SLUG_MISSING");
    if (FORBIDDEN_SEMANTIC.some(rx => rx.test(name))) rowIssues.push("FORBIDDEN_SEMANTIC_PATTERN");
    if (parent && (!clean(parent.district) || !clean(parent.districtId))) rowIssues.push("PARENT_LOCATION_INCOMPLETE");
    if (parent && lower(parent.name) !== lower(row.institution_name)) rowIssues.push("PARENT_NAME_MISMATCH");

    if (rowIssues.length) issues.push({ stagingId: clean(row.staging_id), issues: rowIssues });

    return parent ? {
      institutionId: parent.id,
      name,
      slug,
      level: clean(row.degree_level),
      pathwayCategory: PathwayCategory.UNIVERSITY_GENERAL,
      entryStage: null,
      subjectAreas: [] as string[],
      availableGroups: [] as string[],
      dataSourceId: "source_ugc",
      sourceRecordId: canonicalProgramSourceRecordId(row.parent_source_record_id, row.program_slug),
      durationMonths: null,
      tuitionMin: null,
      tuitionMax: null,
      description: null,
      careerOutcomes: [] as string[],
      verificationStatus: VerificationStatus.DRAFT,
      sourceUrl: clean(row.program_source_url),
    } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const sourceIds = payloads.map(p => p.sourceRecordId);
  const parentSlugKeys = payloads.map(p => `${p.institutionId}|${lower(p.slug)}`);
  const duplicateSourceIds = duplicateKeys(sourceIds);
  const duplicateParentSlugs = duplicateKeys(parentSlugKeys);

  const existingSource = await prisma.program.findMany({
    where: { dataSourceId: "source_ugc", sourceRecordId: { in: sourceIds } },
    select: { id: true, sourceRecordId: true, verificationStatus: true }
  });

  const institutionIds = [...new Set(payloads.map(p => p.institutionId))];
  const slugs = [...new Set(payloads.map(p => p.slug))];
  const existingSlugCandidates = await prisma.program.findMany({
    where: { institutionId: { in: institutionIds }, slug: { in: slugs } },
    select: { id: true, institutionId: true, slug: true, sourceRecordId: true, verificationStatus: true }
  });
  const keySet = new Set(parentSlugKeys);
  const existingParentSlug = existingSlugCandidates.filter(p => keySet.has(`${p.institutionId}|${lower(p.slug)}`));

  const hardStops: string[] = [];
  if (issues.length) hardStops.push("ROW_VALIDATION_ISSUES");
  if (payloads.length !== rows.length) hardStops.push("PAYLOAD_COUNT_MISMATCH");
  if (duplicateSourceIds.length) hardStops.push("DUPLICATE_SOURCE_RECORD_IDS");
  if (duplicateParentSlugs.length) hardStops.push("DUPLICATE_INSTITUTION_SLUGS");
  if (existingSource.length) hardStops.push("EXISTING_SOURCE_RECORD_COLLISIONS");
  if (existingParentSlug.length) hardStops.push("EXISTING_INSTITUTION_SLUG_COLLISIONS");

  const preflight = {
    status: hardStops.length ? "HARD_STOP" : (apply ? "READY_TO_APPLY" : "DRY_RUN_READY_FOR_EXPLICIT_HUMAN_APPROVAL"),
    mode: apply ? "EXPLICIT_HUMAN_APPROVED_TRANSACTION" : "DRY_RUN_ONLY",
    dbWritesPerformed: false,
    file,
    sha256,
    rowsRead: rows.length,
    payloadsConstructed: payloads.length,
    validationIssues: issues.length,
    duplicateSourceRecordIds: duplicateSourceIds.length,
    duplicateInstitutionSlug: duplicateParentSlugs.length,
    existingSourceRecordCollisions: existingSource.length,
    existingInstitutionSlugCollisions: existingParentSlug.length,
    requiredApprovalToken: APPROVAL_TOKEN,
    policy: {
      sourceVerificationRequired: "PASS_STRONG",
      semanticStatusRequired: "PASS",
      verificationStatus: "DRAFT",
      productionVerified: "NO",
      verifiedPublicationAllowed: false,
      transactionRequired: true
    },
    hardStopReasons: hardStops,
    samples: {
      issues: issues.slice(0, 10),
      existingSource: existingSource.slice(0, 10),
      existingParentSlug: existingParentSlug.slice(0, 10)
    }
  };

  if (hardStops.length) {
    console.log(JSON.stringify(preflight, null, 2));
    process.exitCode = 2;
    return;
  }

  if (!apply) {
    console.log(JSON.stringify(preflight, null, 2));
    return;
  }

  const result = await prisma.$transaction(async tx => {
    const freshSource = await tx.program.findMany({
      where: { dataSourceId: "source_ugc", sourceRecordId: { in: sourceIds } },
      select: { id: true }
    });
    if (freshSource.length) throw new Error("HARD_STOP_IN_TRANSACTION: sourceRecordId collision appeared");

    const freshSlugCandidates = await tx.program.findMany({
      where: { institutionId: { in: institutionIds }, slug: { in: slugs } },
      select: { institutionId: true, slug: true }
    });
    if (freshSlugCandidates.some(p => keySet.has(`${p.institutionId}|${lower(p.slug)}`))) {
      throw new Error("HARD_STOP_IN_TRANSACTION: institution+slug collision appeared");
    }

    const created = await tx.program.createMany({ data: payloads });
    if (created.count !== payloads.length) throw new Error(`HARD_STOP_IN_TRANSACTION: createMany count ${created.count} != ${payloads.length}`);

    const verified = await tx.program.count({
      where: {
        dataSourceId: "source_ugc",
        sourceRecordId: { in: sourceIds },
        verificationStatus: VerificationStatus.DRAFT
      }
    });
    if (verified !== payloads.length) throw new Error(`HARD_STOP_IN_TRANSACTION: DRAFT verification count ${verified} != ${payloads.length}`);

    return { insertedDraftRows: created.count, importedDraftCountVerifiedInsideTransaction: verified };
  }, { maxWait: 15000, timeout: 120000 });

  console.log(JSON.stringify({
    status: "APPLY_SUCCESS",
    mode: "EXPLICIT_HUMAN_APPROVED_TRANSACTION",
    dbWritesPerformed: true,
    file,
    sha256,
    result,
    policyAssertions: {
      insertedRowsAreDraft: true,
      sourceRowsWerePassStrong: true,
      semanticRowsWereStrictPass: true,
      verifiedPublicationPerformed: false
    }
  }, null, 2));
}

main()
  .catch(async e => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
