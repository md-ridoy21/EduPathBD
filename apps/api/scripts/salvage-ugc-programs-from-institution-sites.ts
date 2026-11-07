import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
type Row = Record<string, string>;

function clean(v: unknown): string { return String(v ?? "").trim(); }
function lower(v: unknown): string { return clean(v).toLowerCase(); }

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
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

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Row[], fields: string[]) {
  return [fields.map(csvEscape).join(","), ...rows.map(r => fields.map(f => csvEscape(r[f])).join(","))].join("\n") + "\n";
}
function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hostOf(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}
function registrableLike(a: string, b: string) {
  const x = a.replace(/^www\./, ""), y = b.replace(/^www\./, "");
  return !!x && !!y && (x === y || x.endsWith("." + y) || y.endsWith("." + x));
}
function originFor(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch { return ""; }
}

function htmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(s: string) {
  return s.toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\*\*+/g, " ")
    .replace(/\(\s*\d+\s*\)\s*$/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ID_STOP = new Set([
  "university","of","the","and","bangladesh","science","technology","international",
  "private","public","college","institute"
]);

function identityTokens(name: string) {
  return [...new Set(normalize(name).split(" ").filter(t => t.length >= 3 && !ID_STOP.has(t)))];
}
function institutionIdentityScore(name: string, pageText: string) {
  const n = normalize(name);
  const p = normalize(pageText);
  if (n.length >= 8 && p.includes(n)) return { score: 1, exact: true };
  const ts = identityTokens(name);
  if (!ts.length) return { score: 0, exact: false };
  const pt = new Set(p.split(" "));
  const found = ts.filter(t => pt.has(t)).length;
  return { score: found / ts.length, exact: false };
}

function canonicalProgram(s: string) {
  let x = s.toLowerCase().replace(/[’`]/g, "'");
  const repl: Array<[RegExp, string]> = [
    [/\bbachelor of science\b/g, "bsc"],
    [/\bmaster of science\b/g, "msc"],
    [/\bbachelor of business administration\b/g, "bba"],
    [/\bmaster of business administration\b/g, "mba"],
    [/\bexecutive master of business administration\b/g, "emba"],
    [/\bbachelor of arts\b/g, "ba"],
    [/\bmaster of arts\b/g, "ma"],
    [/\bbachelor of social sciences?\b/g, "bss"],
    [/\bmaster of social sciences?\b/g, "mss"],
    [/\bbachelor of laws?\b/g, "llb"],
    [/\bmaster of laws?\b/g, "llm"],
    [/\bbachelor of pharmacy\b/g, "bpharm"],
    [/\bmaster of pharmacy\b/g, "mpharm"],
    [/\bbachelor of architecture\b/g, "barch"],
    [/\bmaster of architecture\b/g, "march"],
    [/\bdoctor of philosophy\b/g, "phd"],
    [/\bb\s*\.\s*sc\s*\.?/g, "bsc"],
    [/\bm\s*\.\s*sc\s*\.?/g, "msc"],
    [/\bll\s*\.\s*b\s*\.?/g, "llb"],
    [/\bll\s*\.\s*m\s*\.?/g, "llm"],
    [/\bph\s*\.\s*d\s*\.?/g, "phd"],
    [/\bm\s*\.\s*phil\s*\.?/g, "mphil"],
    [/\bhonours?\b|\bhons\b/g, "hons"],
    [/\bprogramme\b/g, "program"],
  ];
  for (const [rx, to] of repl) x = x.replace(rx, to);
  return x.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

const PROGRAM_STOP = new Set([
  "in","of","and","the","a","an","for","to","on","with","program","programme",
  "degree","hons","honours","honors"
]);

function programEvidence(name: string, pageText: string) {
  const c = canonicalProgram(name);
  const p = canonicalProgram(pageText);
  if (!c || !p) return { exact: false, coverage: 0, tokenCount: 0 };

  // Phrase check is intentionally strict.
  const exact = c.length >= 3 && (` ${p} `).includes(` ${c} `);
  const ts = [...new Set(c.split(" ").filter(t => t.length >= 2 && !PROGRAM_STOP.has(t)))];
  const pt = new Set(p.split(" "));
  const found = ts.filter(t => pt.has(t)).length;
  const coverage = ts.length ? found / ts.length : 0;
  return { exact, coverage, tokenCount: ts.length };
}

const FORBIDDEN = [
  /\bread more\b/i, /\bhereby\b/i, /\badmission open\b/i, /\bonline application\b/i,
  /\bapplication form\b/i, /\bapply for\b/i, /\btuition fee\b/i, /\bfee structure\b/i,
  /\bscholarship\b/i, /\bwaiver\b/i, /\bfinal exam\b/i, /\bmarksheet\b/i,
  /\bmark sheet\b/i, /\btranscript\b/i, /\bbirth certificate\b/i,
  /\bnational id\b/i, /\bverification service\b/i, /\bresult of\b/i
];

type FetchResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
  error: string;
};

async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 EduPath-BD-DataVerifier/1.1",
        "accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5"
      }
    });
    const ct = res.headers.get("content-type") ?? "";
    let body = "";
    if (/text\/html|text\/plain|application\/xhtml\+xml/i.test(ct)) {
      body = (await res.text()).slice(0, 4_000_000);
    }
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
      contentType: ct,
      text: body ? htmlToText(body) : "",
      error: ""
    };
  } catch (e) {
    return {
      ok: false, status: 0, finalUrl: url, contentType: "", text: "",
      error: e instanceof Error ? e.message : String(e)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T,R>(items:T[], limit:number, fn:(item:T)=>Promise<R>) {
  const out:R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({length: Math.min(limit, items.length || 1)}, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const fileArg = arg("--file");
  const outArg = arg("--out-dir");
  if (!fileArg || !outArg) {
    throw new Error("Usage: npx tsx scripts/salvage-ugc-programs-from-institution-sites.ts --file <review.csv> --out-dir <dir>");
  }

  const file = resolve(fileArg), outDir = resolve(outArg);
  await mkdir(outDir, { recursive: true });
  const raw = await readFile(file, "utf8");
  const rows = parseCsv(raw);
  if (!rows.length) throw new Error("Input review CSV is empty");

  const parentIds = [...new Set(rows.map(r => lower(r.parent_source_record_id)))];
  const parents = await prisma.institution.findMany({
    where: { dataSourceId: "source_ugc", sourceRecordId: { in: parentIds } },
    select: {
      id: true, name: true, sourceRecordId: true, verificationStatus: true,
      district: true, districtId: true
    }
  });
  const parentMap = new Map(parents.map(p => [lower(p.sourceRecordId), p]));

  // Fetch each original source page.
  const sourceUrls = [...new Set(rows.map(r => clean(r.program_source_url)).filter(u => u.startsWith("https://")))];
  const sourcePairs = await mapLimit(sourceUrls, 12, async url => [url, await fetchPage(url)] as const);
  const sourceMap = new Map(sourcePairs);

  // Fetch each source host homepage; the host must identify the institution before it can be trusted.
  const origins = [...new Set(sourceUrls.map(originFor).filter(Boolean))];
  const originPairs = await mapLimit(origins, 10, async origin => [origin, await fetchPage(origin)] as const);
  const originMap = new Map(originPairs);

  const extra = [
    "source_verification_status",
    "evidence_tier",
    "evidence_source_url",
    "evidence_final_url",
    "evidence_host",
    "institution_identity_score",
    "institution_identity_exact",
    "program_phrase_exact",
    "program_token_coverage",
    "salvage_note"
  ];
  const baseFields = Object.keys(rows[0]!);
  const fields = [...baseFields, ...extra.filter(f => !baseFields.includes(f))];

  const passed:Row[] = [], unresolved:Row[] = [];
  const reasonCounts:Record<string,number> = {};
  const addReason = (r:string) => reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;

  for (const row of rows) {
    const x:Row = {...row};
    const issues:string[] = [];
    const parent = parentMap.get(lower(row.parent_source_record_id));
    const sourceUrl = clean(row.program_source_url);
    const source = sourceMap.get(sourceUrl);
    const origin = originFor(sourceUrl);
    const home = originMap.get(origin);
    const candidate = clean(row.program_name);

    if (!parent) issues.push("PARENT_NOT_FOUND");
    if (!sourceUrl.startsWith("https://")) issues.push("SOURCE_NOT_HTTPS");
    if (clean(row.strict_semantic_status) !== "PASS") issues.push("STRICT_SEMANTIC_NOT_PASS");
    if (clean(row.verification_status) !== "DRAFT") issues.push("STAGING_NOT_DRAFT");
    if (clean(row.production_verified) !== "NO") issues.push("PRODUCTION_VERIFIED_NOT_NO");
    if (FORBIDDEN.some(rx => rx.test(candidate))) issues.push("FORBIDDEN_SEMANTIC_PATTERN");
    if (parent && lower(parent.name) !== lower(row.institution_name)) issues.push("PARENT_NAME_MISMATCH");
    if (parent && (!clean(parent.district) || !clean(parent.districtId))) issues.push("PARENT_LOCATION_INCOMPLETE");

    if (!source?.ok || !source.text) issues.push("SOURCE_PAGE_NOT_FETCHABLE_HTML");
    if (!home?.ok || !home.text) issues.push("SOURCE_HOST_HOMEPAGE_NOT_FETCHABLE_HTML");

    let identity = {score:0, exact:false};
    if (parent && home?.text) {
      identity = institutionIdentityScore(parent.name, home.text);
    }
    const identityStrong =
      identity.exact ||
      (identity.score >= 0.75 && identityTokens(parent?.name ?? "").length >= 2);

    if (!identityStrong) issues.push("HOST_INSTITUTION_IDENTITY_NOT_STRONG");

    if (source && home && source.finalUrl && home.finalUrl &&
        !registrableLike(hostOf(source.finalUrl), hostOf(home.finalUrl))) {
      issues.push("SOURCE_REDIRECT_LEFT_CONFIRMED_HOST");
    }

    let prog = {exact:false,coverage:0,tokenCount:0};
    if (source?.text) prog = programEvidence(candidate, source.text);

    const programStrong =
      prog.exact ||
      (prog.tokenCount >= 2 && prog.coverage >= 0.90);

    if (!programStrong) issues.push("PROGRAM_EVIDENCE_NOT_STRONG_ON_SOURCE_PAGE");

    x.evidence_source_url = sourceUrl;
    x.evidence_final_url = source?.finalUrl ?? "";
    x.evidence_host = hostOf(source?.finalUrl ?? sourceUrl);
    x.institution_identity_score = identity.score.toFixed(3);
    x.institution_identity_exact = String(identity.exact);
    x.program_phrase_exact = String(prog.exact);
    x.program_token_coverage = prog.coverage.toFixed(3);

    if (!issues.length) {
      x.source_verification_status = "PASS_STRONG";
      x.evidence_tier = "CONFIRMED_INSTITUTION_SITE_AND_EXPLICIT_PROGRAM_EVIDENCE";
      x.salvage_note = "Existing canonical UGC parent + confirmed institution-owned source host + explicit program evidence; DRAFT import only.";
      passed.push(x);
    } else {
      x.source_verification_status = "REVIEW_REQUIRED";
      x.evidence_tier = "";
      x.salvage_note = issues.join(" | ");
      unresolved.push(x);
      for (const i of issues) addReason(i);
    }
  }

  const passPath = join(outDir, "program_institution_site_salvage_pass.csv");
  const unresolvedPath = join(outDir, "program_institution_site_unresolved.csv");
  const manifestPath = join(outDir, "PROGRAM_INSTITUTION_SITE_SALVAGE_MANIFEST.json");

  await writeFile(passPath, toCsv(passed, fields), "utf8");
  await writeFile(unresolvedPath, toCsv(unresolved, fields), "utf8");

  const manifest = {
    status: "PASS_INSTITUTION_SITE_SALVAGE_SPLIT",
    mode: "NETWORK_AND_DB_READ_ONLY_VALIDATION",
    dbWritesPerformed: false,
    inputRows: rows.length,
    requiredParentIds: parentIds.length,
    databaseParentsMatched: parents.length,
    uniqueSourceUrls: sourceUrls.length,
    uniqueSourceOrigins: origins.length,
    salvagePassStrongRows: passed.length,
    unresolvedRows: unresolved.length,
    reasonCounts: Object.fromEntries(Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1])),
    policy: {
      canonicalInstitutionIdentitySource: "existing source_ugc parent lineage already reviewed/imported",
      programEvidenceSource: "candidate university/institution source page",
      sourceHostMustIdentifyInstitution: true,
      programMustAppearStronglyOnSourcePage: true,
      semanticPassRequired: true,
      verificationStatusForImport: "DRAFT",
      verifiedPublicationAllowed: false,
      fakeOrInferredProgramCreationAllowed: false
    },
    checks: {
      partitionReconstructsInput: passed.length + unresolved.length === rows.length,
      allPassedStrictSemantic: passed.every(r => clean(r.strict_semantic_status) === "PASS"),
      allPassedDraft: passed.every(r => clean(r.verification_status) === "DRAFT"),
      allPassedProductionVerifiedNo: passed.every(r => clean(r.production_verified) === "NO")
    },
    files: {
      passStrong: "program_institution_site_salvage_pass.csv",
      unresolved: "program_institution_site_unresolved.csv"
    }
  };

  const hardStops = Object.entries(manifest.checks).filter(([,v])=>!v).map(([k])=>k);
  (manifest as any).hardStopReasons = hardStops;
  if (hardStops.length) (manifest as any).status = "HARD_STOP";

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
  if (hardStops.length) process.exitCode = 2;
}

main()
  .catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
