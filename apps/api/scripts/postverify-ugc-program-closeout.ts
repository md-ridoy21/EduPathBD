import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient, VerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string,string>;

function clean(v: unknown) { return String(v ?? "").trim(); }
function lower(v: unknown) { return clean(v).toLowerCase(); }

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') {
        if (text[i+1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell.replace(/\r$/,"")); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,"")); rows.push(row); }
  if (rows.length < 2) return [];
  const headers = rows[0]!.map(h => h.trim());
  return rows.slice(1).filter(r => r.some(v => v.trim())).map(r => {
    const out: Row = {};
    headers.forEach((h,i) => out[h] = (r[i] ?? "").trim());
    return out;
  });
}

function sourceId(parent: string, slug: string) {
  const identity = `${lower(parent)}|${lower(slug)}`;
  return `ugc:program:${createHash("sha256").update(identity).digest("hex").slice(0,32)}`;
}

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i+1] : undefined;
}

async function main() {
  const file1 = arg("--file-a");
  const file2 = arg("--file-b");
  if (!file1 || !file2) {
    throw new Error("Usage: npx tsx scripts/postverify-ugc-program-closeout.ts --file-a <29.csv> --file-b <1179.csv>");
  }

  const rowsA = parseCsv(await readFile(resolve(file1), "utf8"));
  const rowsB = parseCsv(await readFile(resolve(file2), "utf8"));
  const rows = [...rowsA, ...rowsB];

  const ids = rows.map(r => sourceId(r.parent_source_record_id, r.program_slug));
  const uniqueIds = [...new Set(ids)];

  const db = await prisma.program.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: uniqueIds }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      institutionId: true,
      sourceRecordId: true,
      verificationStatus: true,
      sourceUrl: true,
    }
  });

  const byId = new Map(db.map(x => [x.sourceRecordId, x]));
  const missing = uniqueIds.filter(id => !byId.has(id));
  const nonDraft = db.filter(x => x.verificationStatus !== VerificationStatus.DRAFT);

  const duplicateCsvIds = ids.length - uniqueIds.length;

  const dbAllUgcPrograms = await prisma.program.findMany({
    where: { dataSourceId: "source_ugc" },
    select: {
      id: true,
      sourceRecordId: true,
      institutionId: true,
      slug: true,
      verificationStatus: true,
    }
  });

  const importedIdSet = new Set(uniqueIds);
  const unexpectedUgcPrograms = dbAllUgcPrograms.filter(
    x => !x.sourceRecordId || !importedIdSet.has(x.sourceRecordId)
  );

  const parentSlug = new Map<string, number>();
  for (const p of dbAllUgcPrograms) {
    const k = `${p.institutionId}|${lower(p.slug)}`;
    parentSlug.set(k, (parentSlug.get(k) ?? 0) + 1);
  }
  const duplicateParentSlugRows = [...parentSlug.entries()]
    .filter(([,n]) => n > 1)
    .map(([k,n]) => ({key:k,count:n}));

  const verificationCounts = dbAllUgcPrograms.reduce<Record<string,number>>((acc,p) => {
    acc[p.verificationStatus] = (acc[p.verificationStatus] ?? 0) + 1;
    return acc;
  }, {});

  const checks = {
    expectedFileA29: rowsA.length === 29,
    expectedFileB1179: rowsB.length === 1179,
    expectedCombined1208: rows.length === 1208,
    noDuplicateCsvSourceIds: duplicateCsvIds === 0,
    all1208FoundInDb: db.length === 1208 && missing.length === 0,
    allImportedRemainDraft: nonDraft.length === 0,
    totalUgcProgramsExactly1208: dbAllUgcPrograms.length === 1208,
    noUnexpectedUgcPrograms: unexpectedUgcPrograms.length === 0,
    noDuplicateInstitutionSlug: duplicateParentSlugRows.length === 0,
    noVerifiedUgcPrograms: (verificationCounts["VERIFIED"] ?? 0) === 0,
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([,ok]) => !ok)
    .map(([k]) => k);

  console.log(JSON.stringify({
    status: hardStopReasons.length ? "HARD_STOP" : "PASS_UGC_PROGRAM_DB_CLOSEOUT",
    mode: "READ_ONLY_POST_IMPORT_CLOSEOUT",
    dbWritesPerformed: false,
    fileARows: rowsA.length,
    fileBRows: rowsB.length,
    combinedExpectedImportedRows: rows.length,
    uniqueExpectedSourceRecordIds: uniqueIds.length,
    databaseMatchedExpectedRows: db.length,
    databaseTotalUgcPrograms: dbAllUgcPrograms.length,
    verificationCounts,
    missingExpectedRows: missing.length,
    unexpectedUgcPrograms: unexpectedUgcPrograms.length,
    duplicateInstitutionSlugRows: duplicateParentSlugRows.length,
    checks,
    hardStopReasons,
    samples: {
      missing: missing.slice(0,10),
      unexpectedUgcPrograms: unexpectedUgcPrograms.slice(0,10),
      duplicateInstitutionSlugRows: duplicateParentSlugRows.slice(0,10),
      nonDraft: nonDraft.slice(0,10),
    }
  }, null, 2));

  if (hardStopReasons.length) process.exitCode = 2;
}

main()
  .catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
