import { z } from "zod";
import type { AdmissionRuleRecord, RecommendationCandidateRecord } from "../data/store.js";

const gpa = z.number().min(0).max(5);
const pathway = z.enum(["GENERAL_SCHOOL", "GENERAL_COLLEGE", "POLYTECHNIC_DIPLOMA", "TECHNICAL_VOCATIONAL", "MEDICAL_TECHNOLOGY", "NURSING_MIDWIFERY", "UNIVERSITY_GENERAL", "ENGINEERING", "MEDICAL_DENTAL", "PROFESSIONAL", "SKILLS_TRAINING", "HIGHER_STUDY"]);

export const recommendationProfileSchema = z.object({
  stage: z.enum(["SSC", "HSC", "DIPLOMA", "UNDERGRADUATE", "GRADUATE"]),
  group: z.enum(["SCIENCE", "BUSINESS_STUDIES", "HUMANITIES", "VOCATIONAL"]),
  sscGpa: gpa.optional(),
  hscGpa: gpa.optional(),
  graduationCgpa: z.number().min(0).max(4).optional(),
  districtCode: z.string().trim().min(2).max(40).optional(),
  upazilaCode: z.string().trim().min(2).max(40).optional(),
  scope: z.enum(["UPAZILA", "DISTRICT", "NATIONWIDE", "INTERNATIONAL"]).optional(),
  pathways: z.array(pathway).max(12).default([]),
  interests: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  subjectResults: z.record(z.string(), gpa).default({}),
  monthlyBudgetMax: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(50).default(20)
});

export type RecommendationProfile = z.infer<typeof recommendationProfileSchema>;
export type EligibilityConfidence = "ELIGIBLE" | "INELIGIBLE" | "NEEDS_VERIFICATION";

const defaultPathways: Record<RecommendationProfile["stage"], string[]> = {
  SSC: ["GENERAL_COLLEGE", "POLYTECHNIC_DIPLOMA", "TECHNICAL_VOCATIONAL", "MEDICAL_TECHNOLOGY", "NURSING_MIDWIFERY", "SKILLS_TRAINING"],
  HSC: ["UNIVERSITY_GENERAL", "ENGINEERING", "MEDICAL_DENTAL", "PROFESSIONAL"],
  DIPLOMA: ["ENGINEERING", "UNIVERSITY_GENERAL", "PROFESSIONAL", "SKILLS_TRAINING"],
  UNDERGRADUATE: ["HIGHER_STUDY", "PROFESSIONAL", "SKILLS_TRAINING"],
  GRADUATE: ["HIGHER_STUDY", "PROFESSIONAL"]
};

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function tokens(values: string[]) {
  return new Set(values.join(" ").toLowerCase().split(/[^a-z0-9\u0980-\u09ff]+/).filter((term) => term.length > 2));
}

function inferScope(profile: RecommendationProfile) {
  if (profile.scope) return profile.scope;
  if (profile.stage === "SSC") return profile.upazilaCode ? "UPAZILA" : profile.districtCode ? "DISTRICT" : "NATIONWIDE";
  return "NATIONWIDE";
}

function evaluateRule(profile: RecommendationProfile, rule: AdmissionRuleRecord): { status: EligibilityConfidence; reasons: string[] } {
  const reasons: string[] = [];
  if (normalize(rule.applicantStage) !== profile.stage) return { status: "INELIGIBLE", reasons: [`Requires ${rule.applicantStage} stage`] };
  if (rule.allowedGroups.length && !rule.allowedGroups.some((group) => normalize(group) === profile.group)) reasons.push(`${profile.group.replaceAll("_", " ")} group is not listed`);
  if (rule.minimumSscGpa !== undefined && (profile.sscGpa === undefined || profile.sscGpa < rule.minimumSscGpa)) reasons.push(`SSC GPA ${rule.minimumSscGpa}+ is required`);
  if (rule.minimumHscGpa !== undefined && (profile.hscGpa === undefined || profile.hscGpa < rule.minimumHscGpa)) reasons.push(`HSC GPA ${rule.minimumHscGpa}+ is required`);
  if (rule.minimumCombinedGpa !== undefined && (profile.sscGpa === undefined || profile.hscGpa === undefined || profile.sscGpa + profile.hscGpa < rule.minimumCombinedGpa)) reasons.push(`Combined GPA ${rule.minimumCombinedGpa}+ is required`);
  for (const required of rule.requiredSubjects ?? []) {
    if (!(required in profile.subjectResults)) reasons.push(`${required} result is required`);
  }
  for (const [subject, minimum] of Object.entries(rule.minimumSubjectGrades ?? {})) {
    const result = profile.subjectResults[subject];
    if (result === undefined || result < minimum) reasons.push(`${subject} grade ${minimum}+ is required`);
  }
  return reasons.length ? { status: "INELIGIBLE", reasons } : { status: "ELIGIBLE", reasons: [`Matches verified ${rule.academicSession} admission rule`] };
}

function locationFit(profile: RecommendationProfile, candidate: RecommendationCandidateRecord, scope: string) {
  const sameDistrict = Boolean(profile.districtCode && candidate.institution.districtCode === profile.districtCode);
  const sameUpazila = Boolean(profile.upazilaCode && candidate.institution.upazilaCode === profile.upazilaCode);
  if (scope === "INTERNATIONAL") return { included: false, score: 0, reason: "International records require a country-aware verified catalog" };
  if (scope === "UPAZILA") return { included: sameUpazila, score: sameUpazila ? 30 : 0, reason: sameUpazila ? `In selected upazila: ${candidate.institution.upazila}` : "Outside selected upazila" };
  if (scope === "DISTRICT") return { included: sameDistrict, score: sameUpazila ? 30 : sameDistrict ? 22 : 0, reason: sameUpazila ? `In selected upazila: ${candidate.institution.upazila}` : sameDistrict ? `In selected district: ${candidate.institution.district}` : "Outside selected district" };
  return { included: true, score: sameUpazila ? 8 : sameDistrict ? 5 : 0, reason: sameUpazila ? "Nearby option" : sameDistrict ? "Same-district option" : "Nationwide option" };
}

export function recommendPrograms(profile: RecommendationProfile, candidates: RecommendationCandidateRecord[]) {
  const scopeApplied = inferScope(profile);
  const wantedPathways = new Set(profile.pathways.length ? profile.pathways : defaultPathways[profile.stage]);
  const interestTerms = tokens(profile.interests);
  const assessed = candidates.map((candidate) => {
    if (candidate.entryStage && normalize(candidate.entryStage) !== profile.stage) return null;
    if (!wantedPathways.has(candidate.pathwayCategory)) return null;
    const location = locationFit(profile, candidate, scopeApplied);
    if (!location.included) return null;
    const ruleResults = candidate.admissionRules.map((rule) => evaluateRule(profile, rule));
    const eligibleRule = ruleResults.find((result) => result.status === "ELIGIBLE");
    const eligibility: EligibilityConfidence = eligibleRule ? "ELIGIBLE" : ruleResults.length ? "INELIGIBLE" : "NEEDS_VERIFICATION";
    if (eligibility === "INELIGIBLE") return null;

    const candidateTerms = tokens([candidate.name, candidate.institution.name, ...candidate.subjectAreas, ...candidate.careerOutcomes]);
    const interestHits = [...interestTerms].filter((term) => candidateTerms.has(term)).length;
    const interestScore = Math.min(25, interestHits * 8);
    const budgetFits = profile.monthlyBudgetMax === undefined || candidate.tuitionMax === undefined || candidate.tuitionMax / Math.max(1, candidate.durationMonths ?? 12) <= profile.monthlyBudgetMax;
    const evidenceScore = eligibility === "ELIGIBLE" ? 25 : candidate.sourceUrl && candidate.institution.sourceUrl ? 12 : 5;
    const score = Math.min(100, 20 + location.score + interestScore + evidenceScore + (budgetFits ? 8 : 0));
    const reasons = [location.reason, ...(eligibleRule?.reasons ?? ["Admission rule is not yet structured; verify the official source"]), ...(interestHits ? [`Matches ${interestHits} interest term${interestHits === 1 ? "" : "s"}`] : []), budgetFits ? "Within recorded budget information" : "Recorded tuition may exceed budget"];
    return {
      rankScore: score,
      eligibility,
      dataConfidence: eligibility === "ELIGIBLE" && candidate.sourceUrl ? "HIGH" as const : candidate.sourceUrl ? "MEDIUM" as const : "LOW" as const,
      reasons,
      program: candidate
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).sort((left, right) => right.rankScore - left.rankScore || left.program.institution.name.localeCompare(right.program.institution.name));

  return {
    engine: "verified-pathway-recommender-v1",
    scopeApplied,
    pathwaysApplied: [...wantedPathways],
    candidatesEvaluated: candidates.length,
    matchesFound: assessed.length,
    matches: assessed.slice(0, profile.limit),
    caveats: [
      "ELIGIBLE means the supplied profile passed the latest structured rule stored by EduPath; always recheck the linked official notice.",
      "NEEDS_VERIFICATION means the institution/program is verified but a current machine-readable admission rule is not available.",
      ...(scopeApplied === "INTERNATIONAL" ? ["International matching remains empty until country-aware records from official providers are imported; Bangladesh records are never relabelled as international."] : [])
    ]
  };
}
