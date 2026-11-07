import type { InstitutionType } from "@prisma/client";
import { z } from "zod";

const gpa = z.number().min(0).max(5);

export const eligibilitySchema = z.object({
  level: z.enum(["SSC", "HSC", "UNDERGRADUATE"]),
  group: z.enum(["SCIENCE", "BUSINESS_STUDIES", "HUMANITIES", "VOCATIONAL"]),
  gpa,
  sscGpa: gpa.optional(),
  hscGpa: gpa.optional(),
  interest: z.string().min(2).max(100)
});

export type EligibilityProfile = z.infer<typeof eligibilitySchema>;

export type AdmissionRuleInput = {
  id: string;
  programId: string;
  programName: string;
  institutionName: string;
  institutionType: InstitutionType;
  academicSession: string;
  applicantStage: string;
  allowedGroups: string[];
  minimumSscGpa?: number;
  minimumHscGpa?: number;
  minimumCombinedGpa?: number;
  additionalCriteria?: string;
  sourceUrl: string;
};

const pathwayNames = {
  engineering: "Engineering & Technology",
  medical: "Medical & Health Sciences",
  business: "Business & Management",
  technical: "Diploma & Technical Skills",
  general: "General & Multidisciplinary Studies"
} as const;

export type PathwayId = keyof typeof pathwayNames;

function inferPathway(rule: AdmissionRuleInput): PathwayId {
  const searchable = `${rule.programName} ${rule.institutionName}`.toLowerCase();
  if (rule.institutionType === "MEDICAL" || /medical|mbbs|dental|nursing|health/.test(searchable)) return "medical";
  if (rule.institutionType === "POLYTECHNIC" || rule.institutionType === "TRAINING_PROVIDER" || /diploma|certificate|skill/.test(searchable)) return "technical";
  if (/business|management|finance|marketing|economics|accounting|bba/.test(searchable)) return "business";
  if (rule.institutionType === "ENGINEERING" || /engineering|technology|computer|software|cse|eee|civil|web development/.test(searchable)) return "engineering";
  return "general";
}

function normalize(value: string) {
  return value.trim().toUpperCase().replaceAll(" ", "_");
}

function evaluateRule(profile: EligibilityProfile, rule: AdmissionRuleInput) {
  const pathwayId = inferPathway(rule);
  const requiredStage = normalize(rule.applicantStage);
  const stageEligible = requiredStage === profile.level || (profile.level === "UNDERGRADUATE" && requiredStage === "HSC");
  const groupEligible = rule.allowedGroups.some((group) => normalize(group) === profile.group);
  const sscGpa = profile.sscGpa ?? (profile.level === "SSC" ? profile.gpa : undefined);
  const hscGpa = profile.hscGpa ?? (profile.level !== "SSC" ? profile.gpa : undefined);
  const combinedGpa = sscGpa !== undefined && hscGpa !== undefined ? sscGpa + hscGpa : undefined;
  const checks = [
    { applies: rule.minimumSscGpa !== undefined, passed: sscGpa !== undefined && sscGpa >= (rule.minimumSscGpa ?? 0), label: `SSC GPA ${rule.minimumSscGpa ?? "—"}+` },
    { applies: rule.minimumHscGpa !== undefined, passed: hscGpa !== undefined && hscGpa >= (rule.minimumHscGpa ?? 0), label: `HSC GPA ${rule.minimumHscGpa ?? "—"}+` },
    { applies: rule.minimumCombinedGpa !== undefined, passed: combinedGpa !== undefined && combinedGpa >= (rule.minimumCombinedGpa ?? 0), label: `combined GPA ${rule.minimumCombinedGpa ?? "—"}+` }
  ];
  const academicEligible = checks.every((check) => !check.applies || check.passed);
  const eligible = stageEligible && groupEligible && academicEligible;
  const failedChecks = checks.filter((check) => check.applies && !check.passed).map((check) => check.label);
  const reasons = [
    stageEligible ? `${rule.applicantStage} applicant stage matches` : `requires ${rule.applicantStage} applicant stage`,
    groupEligible ? `${profile.group.replaceAll("_", " ")} group is allowed` : `${profile.group.replaceAll("_", " ")} group is not listed`,
    ...(failedChecks.length ? failedChecks.map((label) => `${label} was not met or supplied`) : ["recorded GPA requirements passed"]),
    ...(rule.additionalCriteria ? [rule.additionalCriteria] : [])
  ];
  return { ...rule, pathwayId, eligible, reasons };
}

export function evaluateEligibility(profile: EligibilityProfile, rules: AdmissionRuleInput[]) {
  const evaluatedPrograms = rules.map((rule) => evaluateRule(profile, rule));
  return (Object.entries(pathwayNames) as Array<[PathwayId, string]>).map(([id, name]) => {
    const programs = evaluatedPrograms.filter((rule) => rule.pathwayId === id);
    const eligiblePrograms = programs.filter((rule) => rule.eligible);
    return {
      id,
      name,
      eligible: eligiblePrograms.length > 0,
      matchingPrograms: eligiblePrograms.length,
      programsEvaluated: programs.length,
      reason: eligiblePrograms.length
        ? `${eligiblePrograms.length} verified program rule${eligiblePrograms.length === 1 ? "" : "s"} matched`
        : programs.length
          ? "No verified program rule matched this profile"
          : "No verified admission rule is available for this pathway",
      programs: eligiblePrograms.slice(0, 5).map((rule) => ({
        id: rule.programId,
        name: rule.programName,
        institutionName: rule.institutionName,
        academicSession: rule.academicSession,
        sourceUrl: rule.sourceUrl,
        reasons: rule.reasons
      }))
    };
  });
}
