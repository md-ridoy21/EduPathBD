import "dotenv/config";

import { createHash } from "node:crypto";
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

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Row[], fields: string[]) {
  const lines = [fields.map(csvEscape).join(",")];
  for (const row of rows) lines.push(fields.map(f => csvEscape(row[f])).join(","));
  return lines.join("\n") + "\n";
}

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function hostMatches(a: string, b: string) {
  const x = a.replace(/^www\./, "");
  const y = b.replace(/^www\./, "");
  return !!x && !!y && (x === y || x.endsWith("." + y) || y.endsWith("." + x));
}

function htmlToText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const STOP = new Set([
  "in","of","and","the","a","an","for","to","on","with","program","programme",
  "hons","honours","degree","science","arts"
]);

function tokens(s: string) {
  return [...new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 2 && !STOP.has(t))
  )];
}

function tokenCoverage(name: string, pageText: string) {
  const ts = tokens(name);
  if (!ts.length) return 0;
  const found = ts.filter(t => pageText.includes(t));
  return found.length / ts.length;
}

function normalizedPhrase(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchEvidence(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "EduPath-BD-DataVerifier/1.1 (+official-source-validation)"
      }
    });
    const contentType = res.headers.get("content-type") ?? "";
    const finalUrl = res.url || url;
    let text = "";
    if (/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
      text = (await res.text()).slice(0, 3_000_000);
    }
    return {
      ok: res.ok,
      status: res.status,
      finalUrl,
      contentType,
      text,
      error: ""
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: "",
      text: "",
      error: e instanceof Error ? e.message : String(e)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
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
  if (!fileArg || !outArg) throw new Error("Usage: npx tsx scripts/verify-ugc-program-official-sources.ts --file <csv> --out-dir <dir>");

  const file = resolve(fileArg);
  const outDir = resolve(outArg);
  await mkdir(outDir, { recursive: true });

  const raw = await readFile(file, "utf8");
  const rows = parseCsv(raw);
  const parentIds = [...new Set(rows.map(r => lower(r.parent_source_record_id)))];

  const parents = await prisma.institution.findMany({
    where: { dataSourceId: "source_ugc", sourceRecordId: { in: parentIds } },
    select: {
      id: true, name: true, sourceRecordId: true, websiteUrl: true,
      sourceUrl: true, district: true, districtId: true, verificationStatus: true
    }
  });

  const parentMap = new Map(parents.map(p => [lower(p.sourceRecordId), p] as const));
  const uniqueUrls = [...new Set(rows.map(r => clean(r.program_source_url)).filter(Boolean))];
  const evidenceList = await mapLimit(uniqueUrls, 12, async url => [url, await fetchEvidence(url)] as const);
  const evidenceMap = new Map(evidenceList);

  const extraFields = [
    "source_verification_status","source_http_status","source_final_url",
    "source_content_type","source_parent_website_url","source_domain_match",
    "source_title_token_coverage","source_exact_phrase_match","source_verification_note"
  ];
  const baseFields = rows.length ? Object.keys(rows[0]!) : [];
  const fields = [...baseFields, ...extraFields.filter(f => !baseFields.includes(f))];

  const passed: Row[] = [];
  const review: Row[] = [];

  for (const row of rows) {
    const x: Row = {...row};
    const rid = lower(row.parent_source_record_id);
    const parent = parentMap.get(rid);
    const sourceUrl = clean(row.program_source_url);
    const ev = evidenceMap.get(sourceUrl);

    let status = "REVIEW_UNKNOWN";
    const notes: string[] = [];
    const parentWebsite = clean(parent?.websiteUrl);
    const sourceHost = hostOf(sourceUrl);
    const parentHost = hostOf(parentWebsite);

    if (!parent) notes.push("PARENT_NOT_FOUND");
    if (!sourceUrl.startsWith("https://")) notes.push("SOURCE_NOT_HTTPS");
    if (!parentWebsite) notes.push("PARENT_WEBSITE_URL_MISSING");

    const originalDomainMatch = parentWebsite ? hostMatches(sourceHost, parentHost) : false;
    const finalHost = hostOf(ev?.finalUrl ?? "");
    const finalDomainMatch = parentWebsite ? hostMatches(finalHost, parentHost) : false;
    const domainMatch = originalDomainMatch && finalDomainMatch;

    if (parentWebsite && !domainMatch) notes.push("SOURCE_DOMAIN_MISMATCH");

    if (!ev) notes.push("SOURCE_NOT_FETCHED");
    else {
      if (!ev.ok) notes.push(`HTTP_OR_NETWORK_FAILURE:${ev.status || ev.error}`);
      if (/application\/pdf/i.test(ev.contentType)) notes.push("PDF_CONTENT_REQUIRES_SEPARATE_REVIEW");
      if (ev.ok && !ev.text && !/application\/pdf/i.test(ev.contentType)) notes.push("NO_TEXT_CONTENT");
    }

    let coverage = 0;
    let exact = false;
    if (ev?.text) {
      const page = htmlToText(ev.text);
      coverage = tokenCoverage(clean(row.program_name), page);
      const phrase = normalizedPhrase(clean(row.program_name));
      const pageNorm = normalizedPhrase(page);
      exact = phrase.length >= 6 && pageNorm.includes(phrase);
      if (!exact && coverage < 0.70) notes.push("PROGRAM_NAME_EVIDENCE_WEAK");
    }

    const strong =
      !!parent &&
      sourceUrl.startsWith("https://") &&
      !!parentWebsite &&
      domainMatch &&
      !!ev?.ok &&
      !!ev.text &&
      (exact || coverage >= 0.70);

    status = strong ? "PASS_STRONG" : "REVIEW_REQUIRED";

    x.source_verification_status = status;
    x.source_http_status = String(ev?.status ?? 0);
    x.source_final_url = ev?.finalUrl ?? "";
    x.source_content_type = ev?.contentType ?? "";
    x.source_parent_website_url = parentWebsite;
    x.source_domain_match = String(domainMatch);
    x.source_title_token_coverage = coverage.toFixed(3);
    x.source_exact_phrase_match = String(exact);
    x.source_verification_note = notes.join(" | ");

    (strong ? passed : review).push(x);
  }

  const passPath = join(outDir, "program_official_verified_pass.csv");
  const reviewPath = join(outDir, "program_official_source_review.csv");
  const manifestPath = join(outDir, "PROGRAM_OFFICIAL_SOURCE_MANIFEST.json");

  await writeFile(passPath, toCsv(passed, fields), "utf8");
  await writeFile(reviewPath, toCsv(review, fields), "utf8");

  const manifest = {
    status: "PASS_OFFICIAL_SOURCE_SPLIT",
    mode: "READ_ONLY_NETWORK_AND_DB_VALIDATION",
    dbWritesPerformed: false,
    inputFile: file,
    inputSha256: createHash("sha256").update(raw).digest("hex"),
    inputRows: rows.length,
    uniqueSourceUrls: uniqueUrls.length,
    requiredParents: parentIds.length,
    databaseParentsMatched: parents.length,
    passStrongRows: passed.length,
    reviewRequiredRows: review.length,
    policy: {
      passRequiresHttps: true,
      passRequiresExactParent: true,
      passRequiresParentWebsiteUrl: true,
      passRequiresSourceAndRedirectDomainMatchParentWebsite: true,
      passRequiresSuccessfulFetch: true,
      passRequiresHtmlTextEvidence: true,
      passRequiresExactPhraseOrTokenCoverage: 0.70,
      pdfAutoPass: false,
      verifiedPublicationAllowed: false
    },
    checks: {
      partitionReconstructsInput: passed.length + review.length === rows.length,
      noVerifiedWrites: true
    },
    files: {
      passStrong: "program_official_verified_pass.csv",
      reviewRequired: "program_official_source_review.csv"
    }
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main()
  .catch(e => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
