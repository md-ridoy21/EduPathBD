import assert from "node:assert/strict";
import test from "node:test";
import { recommendPrograms, recommendationProfileSchema } from "./recommendation.js";
import type { RecommendationCandidateRecord } from "../data/store.js";

const base = (overrides: Partial<RecommendationCandidateRecord>): RecommendationCandidateRecord => ({
  id: "program_1", name: "Diploma in Computer Technology", level: "Diploma", pathwayCategory: "POLYTECHNIC_DIPLOMA", entryStage: "SSC", subjectAreas: ["Computer"], availableGroups: ["SCIENCE", "VOCATIONAL"], careerOutcomes: ["Developer"], sourceUrl: "https://bteb.gov.bd/program", institution: { id: "institution_1", name: "District Polytechnic", type: "POLYTECHNIC", districtCode: "BD-CTG", district: "Chattogram", upazilaCode: "BD-CTG-01", upazila: "Raozan", sourceUrl: "https://bteb.gov.bd" }, admissionRules: [], ...overrides
});

test("SSC recommendation defaults to exact upazila when supplied", () => {
  const profile = recommendationProfileSchema.parse({ stage: "SSC", group: "SCIENCE", sscGpa: 4.5, districtCode: "BD-CTG", upazilaCode: "BD-CTG-01" });
  const result = recommendPrograms(profile, [base({}), base({ id: "outside", institution: { ...base({}).institution, upazilaCode: "BD-CTG-02" } })]);
  assert.equal(result.scopeApplied, "UPAZILA");
  assert.deepEqual(result.matches.map((item) => item.program.id), ["program_1"]);
});

test("HSC recommendation searches nationwide and rejects failed rules", () => {
  const university = base({ id: "university", name: "Computer Science", pathwayCategory: "ENGINEERING", entryStage: "HSC", institution: { ...base({}).institution, type: "PUBLIC_UNIVERSITY", districtCode: "BD-DHA", district: "Dhaka" }, admissionRules: [{ id: "rule", programId: "university", programName: "Computer Science", institutionName: "University", institutionType: "PUBLIC_UNIVERSITY", academicSession: "2026-27", applicantStage: "HSC", allowedGroups: ["SCIENCE"], minimumHscGpa: 4.5, sourceUrl: "https://ugc.gov.bd" }] });
  const profile = recommendationProfileSchema.parse({ stage: "HSC", group: "SCIENCE", hscGpa: 4.8, districtCode: "BD-CTG", pathways: ["ENGINEERING"], interests: ["Computer"] });
  const result = recommendPrograms(profile, [university]);
  assert.equal(result.scopeApplied, "NATIONWIDE");
  assert.equal(result.matches[0]?.eligibility, "ELIGIBLE");
});

test("international scope never relabels Bangladesh programs as overseas matches", () => {
  const profile = recommendationProfileSchema.parse({ stage: "UNDERGRADUATE", group: "SCIENCE", graduationCgpa: 3.6, scope: "INTERNATIONAL" });
  const localHigherStudy = base({ id: "masters", name: "Master of Science", pathwayCategory: "HIGHER_STUDY", entryStage: "UNDERGRADUATE", institution: { ...base({}).institution, type: "PUBLIC_UNIVERSITY", districtCode: "BD-DHA", district: "Dhaka" } });
  const result = recommendPrograms(profile, [localHigherStudy]);
  assert.equal(result.matchesFound, 0);
  assert.match(result.caveats.at(-1) ?? "", /country-aware records/i);
});
