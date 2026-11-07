import "dotenv/config";

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
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

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string,unknown>[], fields: string[]) {
  return [fields.map(csvEscape).join(","), ...rows.map(r => fields.map(f => csvEscape(r[f])).join(","))].join("\n") + "\n";
}

function norm(s: string) {
  return s.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["in","of","and","the","a","an","for","to","program","programme","degree","hons","honours"]);
function tokens(s: string) {
  return new Set(norm(s).split(" ").filter(x => x.length >= 2 && !STOP.has(x)));
}
function jaccard(a: string, b: string) {
  const A=tokens(a), B=tokens(b);
  const u = new Set([...A,...B]);
  if (!u.size) return 0;
  let i=0;
  for (const x of A) if (B.has(x)) i++;
  return i/u.size;
}

async function main() {
  const fileA = arg("--file-a");
  const fileB = arg("--file-b");
  const outDirArg = arg("--out-dir");
  if (!fileA || !fileB || !outDirArg) {
    throw new Error("Usage: npx tsx scripts/postverify-ugc-program-closeout-v2.ts --file-a <29.csv> --file-b <1179.csv> --out-dir <dir>");
  }

  const outDir = resolve(outDirArg);
  await mkdir(outDir, {recursive:true});

  const rowsA = parseCsv(await readFile(resolve(fileA), "utf8"));
  const rowsB = parseCsv(await readFile(resolve(fileB), "utf8"));
  const expectedRows = [...rowsA, ...rowsB];
  const expectedIds = expectedRows.map(r => sourceId(r.parent_source_record_id, r.program_slug));
  const uniqueExpectedIds = [...new Set(expectedIds)];

  const expectedDb = await prisma.program.findMany({
    where: { dataSourceId: "source_ugc", sourceRecordId: { in: uniqueExpectedIds } },
    select: {
      id:true, name:true, slug:true, institutionId:true, sourceRecordId:true,
      verificationStatus:true, sourceUrl:true
    }
  });

  const allUgc = await prisma.program.findMany({
    where: { dataSourceId: "source_ugc" },
    select: {
      id:true, name:true, slug:true, institutionId:true, sourceRecordId:true,
      verificationStatus:true, sourceUrl:true
    },
    orderBy: [{institutionId:"asc"},{slug:"asc"}]
  });

  const expectedSet = new Set(uniqueExpectedIds);
  const canonicalImported = allUgc.filter(p => !!p.sourceRecordId && expectedSet.has(p.sourceRecordId));
  const extraCanonical = allUgc.filter(p => !!p.sourceRecordId && !expectedSet.has(p.sourceRecordId));
  const legacyNoLineage = allUgc.filter(p => !p.sourceRecordId);

  const missing = uniqueExpectedIds.filter(id => !expectedDb.some(p => p.sourceRecordId === id));
  const importedNonDraft = canonicalImported.filter(p => p.verificationStatus !== VerificationStatus.DRAFT);
  const legacyNonVerified = legacyNoLineage.filter(p => p.verificationStatus !== VerificationStatus.VERIFIED);

  const exactKeys = new Map<string, number>();
  for (const p of allUgc) {
    const k = `${p.institutionId}|${lower(p.slug)}`;
    exactKeys.set(k, (exactKeys.get(k) ?? 0) + 1);
  }
  const exactDuplicateInstitutionSlug = [...exactKeys.entries()]
    .filter(([,n]) => n > 1)
    .map(([key,count]) => ({key,count}));

  // Heuristic legacy semantic overlap report only; never mutates data.
  const importedByInstitution = new Map<string, typeof canonicalImported>();
  for (const p of canonicalImported) {
    const arr = importedByInstitution.get(p.institutionId) ?? [];
    arr.push(p);
    importedByInstitution.set(p.institutionId, arr);
  }

  const legacyReview = legacyNoLineage.map(l => {
    const candidates = (importedByInstitution.get(l.institutionId) ?? [])
      .map(c => ({
        id:c.id,
        name:c.name,
        slug:c.slug,
        sourceRecordId:c.sourceRecordId,
        score:Math.max(
          jaccard(l.name, c.name),
          jaccard(l.slug, c.slug),
          jaccard(l.name, c.slug)
        )
      }))
      .sort((a,b)=>b.score-a.score);

    const best = candidates[0];
    return {
      legacyId:l.id,
      legacyName:l.name,
      legacySlug:l.slug,
      institutionId:l.institutionId,
      legacyVerificationStatus:l.verificationStatus,
      legacySourceRecordId:l.sourceRecordId ?? "",
      bestCanonicalCandidateId:best?.id ?? "",
      bestCanonicalCandidateName:best?.name ?? "",
      bestCanonicalCandidateSlug:best?.slug ?? "",
      bestCanonicalCandidateSourceRecordId:best?.sourceRecordId ?? "",
      bestSimilarityScore:best ? best.score.toFixed(3) : "0.000",
      assistantAction:"REVIEW_ONLY_NO_DB_CHANGE"
    };
  });

  const legacyFields = [
    "legacyId","legacyName","legacySlug","institutionId","legacyVerificationStatus",
    "legacySourceRecordId","bestCanonicalCandidateId","bestCanonicalCandidateName",
    "bestCanonicalCandidateSlug","bestCanonicalCandidateSourceRecordId",
    "bestSimilarityScore","assistantAction"
  ];
  await writeFile(join(outDir,"legacy_verified_program_lineage_review.csv"), toCsv(legacyReview, legacyFields), "utf8");

  const checks = {
    expectedFileA29: rowsA.length === 29,
    expectedFileB1179: rowsB.length === 1179,
    expectedCombined1208: expectedRows.length === 1208,
    uniqueExpected1208: uniqueExpectedIds.length === 1208,
    allExpectedImportedRowsFound: expectedDb.length === 1208 && missing.length === 0,
    allCanonicalImportedRowsRemainDraft: importedNonDraft.length === 0,
    noExtraCanonicalLineageRows: extraCanonical.length === 0,
    legacyRowsExactly9: legacyNoLineage.length === 9,
    legacyRowsRemainVerified: legacyNonVerified.length === 0,
    noExactInstitutionSlugDuplicates: exactDuplicateInstitutionSlug.length === 0,
  };

  const hardStopReasons = Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  const status = hardStopReasons.length
    ? "HARD_STOP"
    : "PASS_UGC_PROGRAM_DB_CLOSEOUT_WITH_9_LEGACY_VERIFIED";

  const manifest = {
    status,
    mode:"READ_ONLY_POST_IMPORT_CLOSEOUT_V2",
    dbWritesPerformed:false,
    expectedImportedRows:1208,
    databaseMatchedExpectedRows:expectedDb.length,
    databaseTotalUgcPrograms:allUgc.length,
    canonicalImportedDraftRows:canonicalImported.length,
    legacyVerifiedRowsWithoutSourceRecordId:legacyNoLineage.length,
    extraCanonicalLineageRows:extraCanonical.length,
    missingExpectedRows:missing.length,
    importedNonDraftRows:importedNonDraft.length,
    exactInstitutionSlugDuplicateRows:exactDuplicateInstitutionSlug.length,
    policy:{
      legacyRowsArePreExistingAndNotPartOf1208Import:true,
      legacyRowsAreNotDeletedOrDowngraded:true,
      legacyLineageBackfillPerformed:false,
      verifiedPublicationPerformed:false,
    },
    checks,
    hardStopReasons,
    samples:{
      missing:missing.slice(0,10),
      extraCanonical:extraCanonical.slice(0,10),
      legacyRows:legacyNoLineage,
      importedNonDraft:importedNonDraft.slice(0,10),
      exactDuplicateInstitutionSlug:exactDuplicateInstitutionSlug.slice(0,10),
    },
    files:{
      legacyLineageReview:"legacy_verified_program_lineage_review.csv"
    }
  };

  await writeFile(join(outDir,"UGC_PROGRAM_DB_CLOSEOUT_V2.json"), JSON.stringify(manifest,null,2),"utf8");
  console.log(JSON.stringify(manifest,null,2));

  if (hardStopReasons.length) process.exitCode=2;
}

main()
  .catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode=1; })
  .finally(async()=>{await prisma.$disconnect();});
