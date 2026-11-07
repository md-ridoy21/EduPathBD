import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { CsvImportError, parseCsv } from "../src/import/csv.js";
import { officialSources } from "../src/data/official-sources.js";

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const valueAfter = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const kind = valueAfter("--kind");
const fileArg = valueAfter("--file");
const sourceId = valueAfter("--source");
const commit = args.includes("--commit");
const publishVerified = args.includes("--publish-verified");

if (!kind || !["upazilas", "institutions", "programs"].includes(kind) || !fileArg || !sourceId) {
  throw new Error("Usage: npm run data:import:official -- --kind <upazilas|institutions|programs> --file <csv> --source <source_id> [--commit] [--publish-verified]");
}
if (publishVerified && !commit) throw new Error("--publish-verified requires --commit.");
if (publishVerified && process.env.ALLOW_VERIFIED_CATALOG_IMPORT !== "YES") {
  throw new Error("Refusing VERIFIED import. Set ALLOW_VERIFIED_CATALOG_IMPORT=YES only after explicit production verification.");
}

const source = officialSources.find((candidate) => candidate.id === sourceId);
if (!source) throw new Error(`Unknown source '${sourceId}'. Use one of: ${officialSources.map((item) => item.id).join(", ")}`);

const requiredHeaders: Record<string, string[]> = {
  upazilas: ["official_code", "district_code", "name", "name_bn"],
  institutions: ["source_record_id", "official_code", "name", "slug", "type", "ownership", "district_code", "upazila_code", "address", "website_url", "source_url", "latitude", "longitude"],
  programs: ["source_record_id", "institution_official_code", "name", "slug", "level", "pathway_category", "entry_stage", "subject_areas", "available_groups", "duration_months", "tuition_min", "tuition_max", "source_url"]
};

const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "must use HTTPS");
const optionalHttpsUrl = z.union([z.literal(""), httpsUrl]);
const upazilaRow = z.object({
  official_code: z.string().trim().min(1).max(40), district_code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(2).max(100), name_bn: z.string().trim().min(2).max(100)
});
const institutionRow = z.object({
  source_record_id: z.string().trim().min(1).max(100), official_code: z.string().trim().max(100),
  name: z.string().trim().min(2).max(180), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(["SCHOOL", "COLLEGE", "PUBLIC_UNIVERSITY", "PRIVATE_UNIVERSITY", "ENGINEERING", "MEDICAL", "NATIONAL_UNIVERSITY_COLLEGE", "POLYTECHNIC", "TECHNICAL", "TRAINING_PROVIDER"]),
  ownership: z.enum(["PUBLIC", "PRIVATE", "AUTONOMOUS", "INTERNATIONAL", "OTHER"]),
  district_code: z.string().trim().min(1).max(40), upazila_code: z.string().trim().max(40), address: z.string().trim().max(300),
  website_url: optionalHttpsUrl, source_url: httpsUrl,
  latitude: z.union([z.literal(""), z.coerce.number().min(20).max(27)]), longitude: z.union([z.literal(""), z.coerce.number().min(88).max(93)])
});
const programRow = z.object({
  source_record_id: z.string().trim().min(1).max(100), institution_official_code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(180), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), level: z.string().trim().min(2).max(80),
  pathway_category: z.enum(["GENERAL_SCHOOL", "GENERAL_COLLEGE", "POLYTECHNIC_DIPLOMA", "TECHNICAL_VOCATIONAL", "MEDICAL_TECHNOLOGY", "NURSING_MIDWIFERY", "UNIVERSITY_GENERAL", "ENGINEERING", "MEDICAL_DENTAL", "PROFESSIONAL", "SKILLS_TRAINING", "HIGHER_STUDY"]),
  entry_stage: z.enum(["SSC", "HSC", "DIPLOMA", "UNDERGRADUATE", "GRADUATE"]), subject_areas: z.string().trim().max(500), available_groups: z.string().trim().max(200),
  duration_months: z.union([z.literal(""), z.coerce.number().int().positive().max(120)]), tuition_min: z.union([z.literal(""), z.coerce.number().int().nonnegative()]),
  tuition_max: z.union([z.literal(""), z.coerce.number().int().nonnegative()]), source_url: httpsUrl
}).refine((row) => row.tuition_min === "" || row.tuition_max === "" || row.tuition_min <= row.tuition_max, { message: "tuition_min cannot exceed tuition_max", path: ["tuition_max"] });

function host(value: string) { return new URL(value).hostname.replace(/^www\./, "").toLowerCase(); }
function relatedDomains(left: string, right: string) {
  const a = host(left); const b = host(right);
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}
function belongsToSource(value: string) { return relatedDomains(value, source.baseUrl); }
function splitList(value: string) { return value.split("|").map((item) => item.trim()).filter(Boolean); }
function duplicateValues(values: string[]) {
  const seen = new Set<string>(); const dup = new Set<string>();
  for (const raw of values) { const value = raw.trim(); if (!value) continue; if (seen.has(value)) dup.add(value); seen.add(value); }
  return [...dup];
}

async function main() {
  const file = resolve(fileArg!); const info = await stat(file);
  if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("Import file must be a CSV smaller than 20 MB.");
  const dbSource = await prisma.dataSource.findUnique({ where: { id: source.id }, select: { id: true } });
  if (!dbSource) throw new Error(`DataSource '${source.id}' is missing. Run the production-safe seed/source sync first.`);

  const input = await readFile(file, "utf8");
  const sha256 = createHash("sha256").update(input).digest("hex");
  const parsed = parseCsv(input, { maxRows: 100_000 });
  const expected = requiredHeaders[kind!]!;
  const missing = expected.filter((header) => !parsed.headers.includes(header));
  const unsupported = parsed.headers.filter((header) => !expected.includes(header));
  if (missing.length || unsupported.length) throw new CsvImportError(`Invalid columns. Missing: ${missing.join(", ") || "none"}. Unsupported: ${unsupported.join(", ") || "none"}.`);

  const errors: Array<{ row: number; message: string }> = [];
  const validated: Array<{ row: number; value: Record<string, unknown> }> = [];
  const schema = kind === "upazilas" ? upazilaRow : kind === "institutions" ? institutionRow : programRow;
  for (const record of parsed.records) {
    const result = schema.safeParse(record.values);
    if (!result.success) { errors.push({ row: record.row, message: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") }); continue; }
    if (kind === "institutions") {
      const row = result.data as z.infer<typeof institutionRow>;
      if (!belongsToSource(row.source_url) && !(row.website_url && relatedDomains(row.source_url, row.website_url))) {
        errors.push({ row: record.row, message: "source_url must belong to the configured authority or the institution's own website domain" }); continue;
      }
    }
    validated.push({ row: record.row, value: result.data });
  }

  const uniqueChecks: Array<[string, string[]]> = kind === "upazilas"
    ? [["official_code", validated.map((x) => String(x.value.official_code ?? ""))]]
    : kind === "institutions"
      ? [["source_record_id", validated.map((x) => String(x.value.source_record_id ?? ""))], ["slug", validated.map((x) => String(x.value.slug ?? ""))]]
      : [["source_record_id", validated.map((x) => String(x.value.source_record_id ?? ""))], ["institution_official_code+slug", validated.map((x) => `${String(x.value.institution_official_code ?? "")}::${String(x.value.slug ?? "")}`)]];
  for (const [label, values] of uniqueChecks) for (const value of duplicateValues(values)) errors.push({ row: 0, message: `Duplicate ${label} '${value}' in import file.` });

  const districtCodes = [...new Set(validated.map((item) => String(item.value.district_code ?? "")).filter(Boolean))];
  const districts = districtCodes.length ? await prisma.district.findMany({ where: { code: { in: districtCodes } }, select: { id: true, code: true, name: true, divisionId: true } }) : [];
  const districtByCode = new Map(districts.map((district) => [district.code, district]));
  for (const code of districtCodes) if (!districtByCode.has(code)) errors.push({ row: 0, message: `Unknown district_code '${code}'. Seed locations before importing.` });

  if (kind === "institutions") {
    const upazilaCodes = [...new Set(validated.map((item) => String(item.value.upazila_code ?? "")).filter(Boolean))];
    const upazilas = upazilaCodes.length ? await prisma.upazila.findMany({ where: { code: { in: upazilaCodes } }, select: { id: true, code: true, districtId: true } }) : [];
    const upazilaByCode = new Map(upazilas.map((upazila) => [upazila.code, upazila]));
    for (const item of validated) {
      const upazilaCode = String(item.value.upazila_code ?? ""); if (!upazilaCode) continue;
      const upazila = upazilaByCode.get(upazilaCode); const district = districtByCode.get(String(item.value.district_code));
      if (!upazila) errors.push({ row: item.row, message: `Unknown upazila_code '${upazilaCode}'.` });
      else if (district && upazila.districtId !== district.id) errors.push({ row: item.row, message: `upazila_code '${upazilaCode}' does not belong to district_code '${district.code}'.` });
      item.value.__upazilaId = upazila?.id;
    }
  }

  if (kind === "programs") {
    const codes = [...new Set(validated.map((item) => String(item.value.institution_official_code)))];
    const institutions = await prisma.institution.findMany({ where: { officialCode: { in: codes } }, select: { id: true, officialCode: true, websiteUrl: true, verificationStatus: true } });
    const byCode = new Map<string, typeof institutions>();
    for (const inst of institutions) { const list = byCode.get(inst.officialCode!) ?? []; list.push(inst); byCode.set(inst.officialCode!, list); }
    for (const item of validated) {
      const code = String(item.value.institution_official_code); const matches = byCode.get(code) ?? [];
      if (!matches.length) { errors.push({ row: item.row, message: `No institution with official code '${code}'.` }); continue; }
      if (matches.length > 1) { errors.push({ row: item.row, message: `Ambiguous institution official code '${code}' matched ${matches.length} records.` }); continue; }
      const institution = matches[0]!;
      if (publishVerified && institution.verificationStatus !== "VERIFIED") { errors.push({ row: item.row, message: `Cannot publish a VERIFIED program while institution '${code}' is not VERIFIED.` }); continue; }
      const sourceUrl = String(item.value.source_url);
      if (!belongsToSource(sourceUrl) && !(institution.websiteUrl && relatedDomains(sourceUrl, institution.websiteUrl))) { errors.push({ row: item.row, message: `Program source_url for '${code}' does not belong to the authority or institution website.` }); continue; }
      item.value.__institutionId = institution.id;
    }
  }

  if (errors.length) { console.error(JSON.stringify({ status: "rejected", dryRun: !commit, kind, source: source.id, recordsRead: parsed.records.length, recordsAccepted: validated.length, recordsRejected: errors.length, errors: errors.slice(0, 100) }, null, 2)); process.exitCode = 1; return; }

  const verificationStatus = publishVerified ? "VERIFIED" : "DRAFT";
  const report = { status: commit ? "committed" : "validated", dryRun: !commit, publishVerified, verificationStatus, kind, source: source.id, file: basename(file), sha256, recordsRead: parsed.records.length, recordsAccepted: validated.length, recordsRejected: 0 };
  if (!commit) { console.log(JSON.stringify(report, null, 2)); return; }

  const importRun = await prisma.dataImportRun.create({ data: { dataSourceId: source.id, status: "VALIDATING", fileName: basename(file), fileSha256: sha256, recordsRead: parsed.records.length, recordsAccepted: validated.length } });
  try {
    await prisma.$transaction(async (database) => {
      for (const item of validated) {
        const row = item.value as Record<string, string> & { __upazilaId?: string; __institutionId?: string };
        if (kind === "upazilas") {
          const district = districtByCode.get(row.district_code)!; const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          await database.upazila.upsert({ where: { code: row.official_code }, create: { id: `upazila_${row.official_code.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, code: row.official_code, districtId: district.id, slug, name: row.name, nameBn: row.name_bn }, update: { districtId: district.id, slug, name: row.name, nameBn: row.name_bn } });
        } else if (kind === "institutions") {
          const district = districtByCode.get(row.district_code)!;
          const data = { name: row.name, slug: row.slug, type: row.type as never, ownership: row.ownership as never, officialCode: row.official_code || null, divisionId: district.divisionId, districtId: district.id, upazilaId: row.__upazilaId ?? null, district: district.name, address: row.address || null, websiteUrl: row.website_url || null, sourceUrl: row.source_url, dataSourceId: source.id, sourceRecordId: row.source_record_id, sourceUpdatedAt: null, verificationStatus: verificationStatus as never, verifiedAt: publishVerified ? new Date() : null, latitude: row.latitude === "" ? null : row.latitude, longitude: row.longitude === "" ? null : row.longitude };
          await database.institution.upsert({ where: { dataSourceId_sourceRecordId: { dataSourceId: source.id, sourceRecordId: row.source_record_id } }, create: data, update: data });
        } else {
          const data = { institutionId: row.__institutionId!, name: row.name, slug: row.slug, level: row.level, pathwayCategory: row.pathway_category as never, entryStage: row.entry_stage, subjectAreas: splitList(row.subject_areas), availableGroups: splitList(row.available_groups), durationMonths: row.duration_months === "" ? null : Number(row.duration_months), tuitionMin: row.tuition_min === "" ? null : Number(row.tuition_min), tuitionMax: row.tuition_max === "" ? null : Number(row.tuition_max), careerOutcomes: [], sourceUrl: row.source_url, dataSourceId: source.id, sourceRecordId: row.source_record_id, verificationStatus: verificationStatus as never };
          await database.program.upsert({ where: { dataSourceId_sourceRecordId: { dataSourceId: source.id, sourceRecordId: row.source_record_id } }, create: data, update: data });
        }
      }
      await database.dataImportRun.update({ where: { id: importRun.id }, data: { status: "COMMITTED", completedAt: new Date(), validationLog: report } });
    }, { maxWait: 10_000, timeout: 120_000 });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await prisma.dataImportRun.update({ where: { id: importRun.id }, data: { status: "REJECTED", completedAt: new Date(), recordsAccepted: 0, recordsRejected: parsed.records.length, validationLog: { message: error instanceof Error ? error.message : String(error) } } });
    throw error;
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
