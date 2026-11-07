import assert from "node:assert/strict";
import test from "node:test";
import { CsvImportError, parseCsv } from "./csv.js";

test("CSV parser preserves quoted commas and escaped quotes", () => {
  const parsed = parseCsv('name,slug,type,district\n"College, Dhaka",college-dhaka,COLLEGE,"Dhaka ""North"""');
  assert.equal(parsed.records[0]!.values.name, "College, Dhaka");
  assert.equal(parsed.records[0]!.values.district, 'Dhaka "North"');
});

test("CSV parser rejects mismatched rows", () => {
  assert.throws(() => parseCsv("name,slug\nOnly a name"), CsvImportError);
});
