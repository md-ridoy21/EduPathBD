import "dotenv/config";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseCsv } from "../src/import/csv.js";

const prisma = new PrismaClient();

const args = process.argv.slice(2);

function valueAfter(flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const fileArg = valueAfter("--file");
const outArg = valueAfter("--out");

if (!fileArg || !outArg) {
  throw new Error(
    "Usage: npx tsx scripts/collect-ugc-parent-location-evidence.ts --file <parent.csv> --out <output.csv>"
  );
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function canonicalId(value: string) {
  return clean(value).toLowerCase();
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function websiteToHttps(value: string) {
  let input = clean(value);
  if (!input) return "";

  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  try {
    const url = new URL(input);
    url.protocol = "https:";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function evidenceExcerpt(text: string, name: string) {
  const rx = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
  const match = rx.exec(text);
  if (!match) return "";

  const start = Math.max(0, match.index - 120);
  const end = Math.min(text.length, match.index + name.length + 180);

  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function extractJsonLd(html: string) {
  const blocks: unknown[] = [];
  const rx =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;

  while ((match = rx.exec(html))) {
    const raw = match[1]?.trim();
    if (!raw) continue;

    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  return blocks;
}

function flattenJson(value: unknown, out: unknown[] = []): unknown[] {
  if (value === null || value === undefined) return out;

  if (Array.isArray(value)) {
    for (const item of value) flattenJson(item, out);
    return out;
  }

  if (typeof value === "object") {
    out.push(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      flattenJson(child, out);
    }
  }

  return out;
}

function structuredAddressText(html: string) {
  const chunks: string[] = [];

  for (const item of flattenJson(extractJsonLd(html))) {
    if (typeof item !== "object" || !item) continue;

    const record = item as Record<string, unknown>;
    const type = clean(record["@type"]);

    if (type.toLowerCase() !== "postaladdress") continue;

    for (const field of [
      "streetAddress",
      "addressLocality",
      "addressRegion",
      "postalCode",
      "addressCountry"
    ]) {
      const value = clean(record[field]);
      if (value) chunks.push(value);
    }
  }

  return chunks.join(", ");
}

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "EduPath-BD-Data-Reconciliation/1.0"
      }
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        finalUrl: response.url,
        html: "",
        error: `HTTP ${response.status}`
      };
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return {
        ok: false,
        status: response.status,
        finalUrl: response.url,
        html: "",
        error: `Unsupported content-type ${contentType}`
      };
    }

    const html = await response.text();

    return {
      ok: true,
      status: response.status,
      finalUrl: response.url,
      html,
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const sourceFile = resolve(fileArg!);
  const outputFile = resolve(outArg!);

  await mkdir(dirname(outputFile), { recursive: true });

  const input = await readFile(sourceFile, "utf8");
  const parsed = parseCsv(input, { maxRows: 500 });

  const districts = await prisma.district.findMany({
    select: {
      code: true,
      name: true,
      nameBn: true
    },
    orderBy: {
      name: "asc"
    }
  });

  const results: Array<Record<string, string | number>> = [];

  let number = 0;

  for (const record of parsed.records) {
    number += 1;

    const row = record.values as Record<string, string>;

    const id = canonicalId(clean(row.parent_source_record_id));
    const institution = clean(row.canonical_name);
    const category = clean(row.category);
    const websiteRaw = clean(row.website);
    const website = websiteToHttps(websiteRaw);
    const ugcIdentityUrl = clean(row.identity_source_url);

    console.log(`[${number}/${parsed.records.length}] ${id} ${institution}`);

    if (!website) {
      results.push({
        parent_source_record_id: id,
        canonical_name: institution,
        category,
        official_website_raw: websiteRaw,
        attempted_url: "",
        fetched_url: "",
        fetch_status: "NO_WEBSITE",
        http_status: 0,
        html_sha256: "",
        structured_address: "",
        district_candidates: "",
        candidate_count: 0,
        evidence_type: "NONE",
        evidence_excerpt: "",
        identity_source_url: ugcIdentityUrl,
        reconciliation_status: "PENDING_MANUAL_EVIDENCE",
        human_decision: "",
        accepted_district: "",
        accepted_district_code: "",
        decision_source_url: "",
        decision_note: ""
      });
      continue;
    }

    const origin = new URL(website).origin;

    const paths = [
      "/",
      "/contact",
      "/contact-us",
      "/about",
      "/about-us"
    ];

    const pages: Array<{
      url: string;
      finalUrl: string;
      html: string;
      status: number;
    }> = [];

    const errors: string[] = [];

    for (const path of paths) {
      const target = new URL(path, origin).toString();
      const fetched = await fetchPage(target);

      if (fetched.ok) {
        pages.push({
          url: target,
          finalUrl: fetched.finalUrl,
          html: fetched.html,
          status: fetched.status
        });
      } else {
        errors.push(`${target}: ${fetched.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!pages.length) {
      results.push({
        parent_source_record_id: id,
        canonical_name: institution,
        category,
        official_website_raw: websiteRaw,
        attempted_url: website,
        fetched_url: "",
        fetch_status: "FETCH_FAILED",
        http_status: 0,
        html_sha256: "",
        structured_address: "",
        district_candidates: "",
        candidate_count: 0,
        evidence_type: "NONE",
        evidence_excerpt: errors.slice(0, 3).join(" | "),
        identity_source_url: ugcIdentityUrl,
        reconciliation_status: "PENDING_MANUAL_EVIDENCE",
        human_decision: "",
        accepted_district: "",
        accepted_district_code: "",
        decision_source_url: "",
        decision_note: ""
      });
      continue;
    }

    const combinedHtml = pages.map((page) => page.html).join("\n");
    const text = stripHtml(combinedHtml);

    const structured = pages
      .map((page) => structuredAddressText(page.html))
      .filter(Boolean)
      .join(" | ");

    const districtMatches = districts.filter((district) => {
      const english = new RegExp(
        `\\b${escapeRegex(district.name)}\\b`,
        "i"
      ).test(`${structured} ${text}`);

      const bangla =
        clean(district.nameBn) &&
        `${structured} ${text}`.includes(district.nameBn);

      return Boolean(english || bangla);
    });

    const structuredMatches = districtMatches.filter((district) => {
      if (!structured) return false;

      return (
        new RegExp(`\\b${escapeRegex(district.name)}\\b`, "i").test(structured) ||
        (clean(district.nameBn) && structured.includes(district.nameBn))
      );
    });

    let evidenceType = "NONE";

    if (structuredMatches.length === 1) {
      evidenceType = "STRUCTURED_ADDRESS_CANDIDATE";
    } else if (districtMatches.length === 1) {
      evidenceType = "SINGLE_TEXT_MENTION_CANDIDATE";
    } else if (districtMatches.length > 1) {
      evidenceType = "AMBIGUOUS_MULTIPLE_DISTRICTS";
    }

    const first = districtMatches[0];

    results.push({
      parent_source_record_id: id,
      canonical_name: institution,
      category,
      official_website_raw: websiteRaw,
      attempted_url: website,
      fetched_url: pages.map((page) => page.finalUrl).join(" | "),
      fetch_status: "FETCHED",
      http_status: pages[0]?.status ?? 0,
      html_sha256: createHash("sha256")
        .update(combinedHtml)
        .digest("hex"),
      structured_address: structured,
      district_candidates: districtMatches
        .map((district) => `${district.code}:${district.name}`)
        .join(" | "),
      candidate_count: districtMatches.length,
      evidence_type: evidenceType,
      evidence_excerpt: first ? evidenceExcerpt(text, first.name) : "",
      identity_source_url: ugcIdentityUrl,
      reconciliation_status: "PENDING_HUMAN_REVIEW",
      human_decision: "",
      accepted_district: "",
      accepted_district_code: "",
      decision_source_url: "",
      decision_note: ""
    });
  }

  const headers = [
    "parent_source_record_id",
    "canonical_name",
    "category",
    "official_website_raw",
    "attempted_url",
    "fetched_url",
    "fetch_status",
    "http_status",
    "html_sha256",
    "structured_address",
    "district_candidates",
    "candidate_count",
    "evidence_type",
    "evidence_excerpt",
    "identity_source_url",
    "reconciliation_status",
    "human_decision",
    "accepted_district",
    "accepted_district_code",
    "decision_source_url",
    "decision_note"
  ];

  const csv = [
    headers.join(","),
    ...results.map((row) =>
      headers.map((header) => csvEscape(row[header] ?? "")).join(",")
    )
  ].join("\n") + "\n";

  await writeFile(outputFile, csv, "utf8");

  const counts = results.reduce(
    (acc, row) => {
      const key = String(row.evidence_type ?? "NONE");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const summary = {
    mode: "READ_ONLY_EVIDENCE_COLLECTION",
    dbWritesPerformed: false,
    parentsRead: parsed.records.length,
    districtsRead: districts.length,
    fetched: results.filter((row) => row.fetch_status === "FETCHED").length,
    fetchFailed: results.filter((row) => row.fetch_status === "FETCH_FAILED").length,
    noWebsite: results.filter((row) => row.fetch_status === "NO_WEBSITE").length,
    evidenceTypeCounts: counts,
    automaticallyAccepted: 0,
    outputFile
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
