import assert from "node:assert/strict";
import test from "node:test";
import { eligibilitySchema, evaluateEligibility } from "./eligibility.js";

const rules = [
  { id: "r1", programId: "p1", programName: "Computer Science and Engineering", institutionName: "BUET", institutionType: "ENGINEERING" as const, academicSession: "2026-27", applicantStage: "HSC", allowedGroups: ["SCIENCE"], minimumHscGpa: 4.5, sourceUrl: "https://example.edu/rule" },
  { id: "r2", programId: "p2", programName: "MBBS", institutionName: "Medical College", institutionType: "MEDICAL" as const, academicSession: "2026-27", applicantStage: "HSC", allowedGroups: ["SCIENCE"], minimumHscGpa: 4.75, sourceUrl: "https://example.edu/rule" },
  { id: "r3", programId: "p3", programName: "Diploma in Computer Technology", institutionName: "Polytechnic", institutionType: "POLYTECHNIC" as const, academicSession: "2026-27", applicantStage: "SSC", allowedGroups: ["SCIENCE", "VOCATIONAL"], minimumSscGpa: 2.5, sourceUrl: "https://example.edu/rule" }
];

test("science profile passes eligible engineering rule", () => {
  const profile = eligibilitySchema.parse({
    level: "HSC",
    group: "SCIENCE",
    gpa: 4.8,
    interest: "Engineering & Technology"
  });
  const result = evaluateEligibility(profile, rules).find((item) => item.id === "engineering");
  assert.equal(result?.eligible, true);
  assert.equal(result?.matchingPrograms, 1);
  assert.equal(result?.programs[0]?.sourceUrl, "https://example.edu/rule");
});

test("non-science profile does not pass medical rule", () => {
  const profile = eligibilitySchema.parse({
    level: "HSC",
    group: "HUMANITIES",
    gpa: 5,
    interest: "Medical & Health Sciences"
  });
  const result = evaluateEligibility(profile, rules).find((item) => item.id === "medical");
  assert.equal(result?.eligible, false);
  assert.equal(result?.matchingPrograms, 0);
});

test("SSC profile is checked against SSC diploma rules rather than HSC rules", () => {
  const profile = eligibilitySchema.parse({ level: "SSC", group: "VOCATIONAL", gpa: 3.2, interest: "Diploma & Technical Skills" });
  const result = evaluateEligibility(profile, rules).find((item) => item.id === "technical");
  assert.equal(result?.eligible, true);
  assert.equal(result?.programs[0]?.id, "p3");
});

test("invalid GPA is rejected before evaluation", () => {
  const result = eligibilitySchema.safeParse({
    level: "HSC",
    group: "SCIENCE",
    gpa: 5.5,
    interest: "Engineering & Technology"
  });
  assert.equal(result.success, false);
});
