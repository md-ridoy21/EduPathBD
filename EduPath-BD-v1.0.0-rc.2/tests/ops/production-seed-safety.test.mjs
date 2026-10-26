import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production seed requires an explicit flag for all time-sensitive demo fixtures", async () => {
  const [rootPackage, apiPackage, source] = await Promise.all([
    readFile(new URL("../../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../apps/api/package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../apps/api/prisma/seed.ts", import.meta.url), "utf8")
  ]);

  assert.equal(apiPackage.scripts["db:seed"], "tsx prisma/seed.ts");
  assert.equal(apiPackage.scripts["db:seed:demo"], "tsx prisma/seed.ts --include-demo-content");
  assert.equal(apiPackage.scripts["db:seed:repair"], "tsx prisma/seed.ts --repair-legacy-demo-data");
  assert.match(rootPackage.scripts["db:seed:demo"], /db:seed:demo/);
  assert.match(rootPackage.scripts["db:seed:repair"], /db:seed:repair/);
  assert.match(source, /process\.argv\.includes\("--include-demo-content"\)/);
  assert.match(source, /process\.argv\.includes\("--repair-legacy-demo-data"\)/);
  assert.match(source, /if \(includeDemoContent\)/);
  assert.match(source, /Existing records were not deleted; run db:seed:repair explicitly after a verified backup/);
  assert.match(source, /prisma\.circular\.deleteMany/);
  assert.match(source, /prisma\.scholarship\.deleteMany/);
  assert.match(source, /prisma\.admissionRule\.deleteMany/);
  assert.match(source, /prisma\.savedItem\.deleteMany/);
  assert.match(source, /if \(repairLegacyDemoData\)/);
  assert.match(source, /repairLegacyDemoData\s*\? \{ tuitionMin: null, tuitionMax: null \}/);
  const demoCatalogGate = source.indexOf("if (includeDemoContent)", source.indexOf("for (const program of demoPrograms)"));
  assert.ok(demoCatalogGate > -1, "time-sensitive demo catalog must be behind the explicit demo flag");
  assert.ok(source.indexOf("for (const circular of demoCirculars)") > demoCatalogGate);
  assert.ok(source.indexOf("for (const scholarship of demoScholarships)") > demoCatalogGate);
  assert.match(source, /sourceUrl: institutionSourceUrl/g);
  assert.ok(source.match(/sourceUrl: institutionSourceUrl/g)?.length >= 4, "program and admission-rule create/update paths must retain an official source");
});
