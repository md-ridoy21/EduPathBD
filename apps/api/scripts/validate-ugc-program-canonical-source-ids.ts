import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = Record<string, string>;

function clean(v: unknown): string {
  return String(v ?? "").trim();
}

function lower(v: unknown): string {
  return clean(v).toLowerCase();
}

function canonicalProgramSourceRecordId(parentSourceRecordId: string, programSlug: string) {
  const identity = `${lower(parentSourceRecordId)}|${lower(programSlug)}`;
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  return `ugc:program:${hash}`;
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

function duplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

async function main() {
  const fileArg = arg("--file");
  if (!fileArg) {
    throw new Error(
      "Usage: npx tsx scripts/validate-ugc-program-canonical-source-ids.ts --file <program_resolved_parent_draft_ready.csv>"
    );
  }

  const file = resolve(fileArg);
  const rows = parseCsv(await readFile(file, "utf8"));

  const mapped = rows.map((row) => ({
    stagingId: clean(row.staging_id),
    parentSourceRecordId: lower(row.parent_source_record_id),
    programSlug: lower(row.program_slug),
    canonicalSourceRecordId: canonicalProgramSourceRecordId(
      row.parent_source_record_id,
      row.program_slug
    ),
  }));

  const sourceIds = mapped.map((r) => r.canonicalSourceRecordId);
  const duplicateCanonicalSourceIds = duplicates(sourceIds);

  const parentSlugKeys = mapped.map(
    (r) => `${r.parentSourceRecordId}|${r.programSlug}`
  );

  const duplicateParentSlug = duplicates(parentSlugKeys);

  const existing = await prisma.program.findMany({
    where: {
      dataSourceId: "source_ugc",
      sourceRecordId: { in: sourceIds },
    },
    select: {
      id: true,
      institutionId: true,
      name: true,
      slug: true,
      sourceRecordId: true,
      verificationStatus: true,
    },
  });

  const checks = {
    expectedRows1542: rows.length === 1542,
    noDuplicateParentSlug: duplicateParentSlug.length === 0,
    noCanonicalSourceIdCollisionsInsideStaging:
      duplicateCanonicalSourceIds.length === 0,
    noExistingCanonicalSourceIdCollisions: existing.length === 0,
    allCanonicalIdsHaveExpectedPrefix:
      mapped.every((r) => r.canonicalSourceRecordId.startsWith("ugc:program:")),
  };

  const hardStopReasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  console.log(JSON.stringify({
    status:
      hardStopReasons.length === 0
        ? "PASS_CANONICAL_PROGRAM_SOURCE_ID_POLICY"
        : "HARD_STOP",
    mode: "READ_ONLY_SOURCE_ID_POLICY_VALIDATION",
    dbWritesPerformed: false,
    file,
    rowsRead: rows.length,
    policy: {
      formula: "ugc:program:<sha256(lower(parent_source_record_id)|lower(program_slug))[:32]>",
      packageVersionIndependent: true,
      stagingIdUsedAsDatabaseSourceRecordId: false,
      candidateIdsUsedAsDatabaseSourceRecordId: false,
    },
    duplicateParentSlug: duplicateParentSlug.length,
    duplicateCanonicalSourceIds: duplicateCanonicalSourceIds.length,
    existingCanonicalSourceIdCollisions: existing.length,
    checks,
    hardStopReasons,
    samples: {
      firstMappings: mapped.slice(0, 5),
      duplicateParentSlug: duplicateParentSlug.slice(0, 10),
      duplicateCanonicalSourceIds: duplicateCanonicalSourceIds.slice(0, 10),
      existingCanonicalSourceIdCollisions: existing.slice(0, 10),
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
