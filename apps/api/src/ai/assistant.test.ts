import assert from "node:assert/strict";
import test from "node:test";
import { selectRelevantSources, type KnowledgeSource } from "./assistant.js";

const sources: KnowledgeSource[] = [
  { id: "engineering-1", title: "BUET — Computer Science and Engineering", detail: "Undergraduate engineering pathway", url: "https://www.buet.ac.bd", verified: true, kind: "PROGRAM", pathwayCategory: "ENGINEERING", entryStage: "HSC", districtCode: "BD-DHA" },
  { id: "engineering-2", title: "University — Civil Engineering", detail: "Undergraduate engineering pathway", url: "https://example.edu", verified: true, kind: "PROGRAM", pathwayCategory: "ENGINEERING", entryStage: "HSC", districtCode: "BD-CTG" },
  { id: "diploma-1", title: "Dhaka Polytechnic — Diploma in Computer Technology", detail: "Diploma technical pathway after SSC", url: "https://dpi.gov.bd", verified: true, kind: "PROGRAM", pathwayCategory: "POLYTECHNIC_DIPLOMA", entryStage: "SSC", districtCode: "BD-DHA", upazilaCode: "BD-DHA-01" },
  { id: "diploma-2", title: "Rangpur Polytechnic — Diploma in Electrical Technology", detail: "Diploma technical pathway after SSC", url: "https://rpi.gov.bd", verified: true, kind: "PROGRAM", pathwayCategory: "POLYTECHNIC_DIPLOMA", entryStage: "SSC", districtCode: "BD-RNG", upazilaCode: "BD-RNG-01" },
  { id: "medical-1", title: "Medical College — MBBS", detail: "Undergraduate medical pathway", url: "https://dghs.gov.bd", verified: true, kind: "PROGRAM", pathwayCategory: "MEDICAL_DENTAL", entryStage: "HSC", districtCode: "BD-DHA" }
];

test("comparison questions receive balanced engineering and diploma evidence", () => {
  const selected = selectRelevantSources("Engineering ও diploma pathway-এর পার্থক্য কী?", sources);
  assert.ok(selected.some((source) => source.id.startsWith("engineering-")));
  assert.ok(selected.some((source) => source.id.startsWith("diploma-")));
  assert.ok(selected.length <= 10);
});

test("SSC local questions never leak records from another upazila", () => {
  const selected = selectRelevantSources("আমার এলাকার diploma option দেখাও", sources, { stage: "SSC", districtCode: "BD-DHA", upazilaCode: "BD-DHA-01" });
  assert.deepEqual(selected.map((source) => source.id), ["diploma-1"]);
});

test("Bangla diploma questions select polytechnic evidence", () => {
  const selected = selectRelevantSources("ডিপ্লোমা এবং প্রকৌশল পথ তুলনা করো", sources);
  assert.ok(selected.some((source) => source.id.startsWith("diploma-")));
  assert.ok(selected.some((source) => source.id.startsWith("engineering-")));
});
