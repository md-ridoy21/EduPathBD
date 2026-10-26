import { Prisma, PrismaClient, type ApplicationStatus, type InstitutionType, type MediaType, type ReportStatus, type UserRole, type VerificationStatus, type VoteType } from "@prisma/client";
import { config } from "../config.js";
import { demoCirculars, demoInstitutions, demoPrograms, demoScholarships } from "./demo-catalog.js";
import { bangladeshDivisions } from "./bangladesh-locations.js";

export type UserRecord = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  emailVerified: boolean;
  phoneVerified: boolean;
};

export type StudentProfileRecord = {
  level: "SSC" | "HSC" | "Diploma" | "Undergraduate" | "Graduate";
  group: "Science" | "Business Studies" | "Humanities" | "Vocational";
  sscGpa: number;
  hscGpa: number;
  graduationCgpa?: number;
  interest: string;
  location: string;
  homeDistrictId?: string;
  homeUpazilaId?: string;
  preferredScope?: "UPAZILA" | "DISTRICT" | "NATIONWIDE" | "INTERNATIONAL";
  preferredPathways?: string[];
  subjectResults?: Record<string, number>;
  profileCompleted: number;
  updatedAt: string;
};

export type InstitutionRecord = {
  id: string;
  name: string;
  slug: string;
  type: InstitutionType;
  district: string;
  division?: string;
  upazila?: string;
  officialCode?: string;
  description?: string;
  websiteUrl?: string;
  sourceUrl?: string;
  verified: boolean;
  programCount: number;
};

export type ProgramRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  name: string;
  slug: string;
  level: string;
  pathwayCategory?: string;
  entryStage?: string;
  subjectAreas?: string[];
  durationMonths?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  groups: string[];
  minimumGpa: number;
  careerOutcomes: string[];
  sourceUrl?: string;
  verified: boolean;
};

export type RecommendationCandidateRecord = {
  id: string;
  name: string;
  level: string;
  pathwayCategory: string;
  entryStage?: string;
  subjectAreas: string[];
  availableGroups: string[];
  durationMonths?: number;
  tuitionMin?: number;
  tuitionMax?: number;
  careerOutcomes: string[];
  sourceUrl?: string;
  institution: {
    id: string;
    name: string;
    type: InstitutionType;
    districtCode?: string;
    district: string;
    upazilaCode?: string;
    upazila?: string;
    sourceUrl?: string;
  };
  admissionRules: AdmissionRuleRecord[];
};

export type CircularRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  title: string;
  academicSession: string;
  applicationStartsAt?: string;
  applicationEndsAt: string;
  examAt?: string;
  applicationFee?: number;
  sourceUrl: string;
  verified: boolean;
};

export type AdmissionRuleRecord = {
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
  requiredSubjects?: string[];
  minimumSubjectGrades?: Record<string, number>;
  additionalCriteria?: string;
  sourceUrl: string;
};

export type ScholarshipRecord = {
  id: string;
  title: string;
  provider: string;
  description?: string;
  institutionName?: string;
  programName?: string;
  minimumGpa?: number;
  groups: string[];
  levels: string[];
  amountDescription?: string;
  deadline?: string;
  sourceUrl: string;
  verified: boolean;
};

export type MediaRecord = {
  id: string;
  institutionId?: string;
  institutionName?: string;
  programId?: string;
  type: MediaType;
  title: string;
  url: string;
  thumbnailUrl?: string;
  languageCode?: "en" | "bn";
  verified: boolean;
  updatedAt: string;
};

export type ApplicationRecord = {
  id: string;
  programId: string;
  programName: string;
  institutionName: string;
  status: ApplicationStatus;
  notes?: string;
  updatedAt: string;
  documents: Array<{ id: string; title: string; isRequired: boolean; isCompleted: boolean }>;
};

export type DiscussionRecord = { id: string; institutionId: string; title: string; body: string; createdAt: string };
export type CommentRecord = {
  id: string;
  postId: string;
  parentId?: string;
  body: string;
  isVerified: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string; role: UserRole };
  likes: number;
  dislikes: number;
  userVote?: VoteType;
};

export type RatingSummary = { average: number; count: number; distribution: Record<string, number>; userScore?: number };
export type ContentReportRecord = {
  id: string;
  reporterId: string;
  reporterUsername: string;
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  resolution?: string;
  createdAt: string;
  reviewedAt?: string;
};

export type AiInteractionRecord = { id: string; userId: string; feature: string; prompt: string; response: string; model: string; sourceIds: string[]; createdAt: string };
export type AdminContentKind = "INSTITUTION" | "PROGRAM" | "CIRCULAR" | "MEDIA";
export type AdminContentRecord = {
  id: string;
  kind: AdminContentKind;
  title: string;
  subtitle: string;
  status: VerificationStatus;
  sourceUrl?: string;
  updatedAt?: string;
  editable: { name?: string; district?: string; level?: string; title?: string; academicSession?: string; sourceUrl?: string; type?: MediaType; url?: string; languageCode?: "en" | "bn" | null };
};

export class UsernameConflictError extends Error {
  constructor() {
    super("This username was just taken. Choose another username.");
    this.name = "UsernameConflictError";
  }
}

const prisma = config.demoMode ? undefined : new PrismaClient();

export async function checkDataStoreReady() {
  if (config.demoMode) return { provider: "demo-memory" as const };
  await prisma!.$queryRaw`SELECT 1`;
  return { provider: "postgresql" as const };
}

export async function disconnectDataStore() {
  await prisma?.$disconnect();
}

const demoUsers: UserRecord[] = [
  {
    id: "user_demo_admin",
    username: "admin_demo",
    email: "admin.demo@edupath.local",
    displayName: "EduPath Admin",
    role: "ADMIN",
    emailVerified: true,
    phoneVerified: true
  },
  { id: "user_demo_guide", username: "guide_demo", email: "guide.demo@edupath.local", displayName: "Verified Guide", role: "MODERATOR", emailVerified: true, phoneVerified: true }
];

const demoSavedInstitutions = new Map<string, Set<string>>();
const demoProfiles = new Map<string, StudentProfileRecord>();
const demoApplications = new Map<string, ApplicationRecord[]>();
const demoDiscussions: DiscussionRecord[] = [
  { id: "post_du_admission", institutionId: "inst_du", title: "University of Dhaka admission discussion", body: "Ask questions and share source-based admission guidance.", createdAt: "2026-09-10T08:00:00.000Z" },
  { id: "post_buet_admission", institutionId: "inst_buet", title: "BUET admission discussion", body: "Discuss preparation, requirements and official notices.", createdAt: "2026-09-10T09:00:00.000Z" }
];
const demoComments: CommentRecord[] = [
  { id: "comment_demo_1", postId: "post_du_admission", body: "Always match your GPA and subject requirements with the latest official circular.", isVerified: true, createdAt: "2026-09-10T08:30:00.000Z", author: { id: "user_demo_guide", username: "guide_demo", displayName: "Verified Guide", role: "MODERATOR" }, likes: 2, dislikes: 0 },
  { id: "comment_demo_2", postId: "post_du_admission", parentId: "comment_demo_1", body: "The source link beside each deadline makes this much easier to verify.", isVerified: false, createdAt: "2026-09-10T09:15:00.000Z", author: { id: "user_demo_admin", username: "admin_demo", displayName: "EduPath Admin", role: "ADMIN" }, likes: 1, dislikes: 0 }
];
const demoVotes = new Map<string, Map<string, VoteType>>([
  ["comment_demo_1", new Map([["sample_1", "LIKE"], ["sample_2", "LIKE"]])],
  ["comment_demo_2", new Map([["sample_3", "LIKE"]])]
]);
const demoRatings = new Map<string, Map<string, number>>([
  ["inst_du", new Map([["sample_1", 5], ["sample_2", 4], ["sample_3", 5]])],
  ["inst_buet", new Map([["sample_1", 5], ["sample_2", 5]])]
]);
const demoAiInteractions: AiInteractionRecord[] = [];
const demoMedia: MediaRecord[] = [];
const demoVerificationStatuses = new Map<string, VerificationStatus>();
const demoContentReports: ContentReportRecord[] = [
  { id: "report_demo_1", reporterId: "user_demo_guide", reporterUsername: "guide_demo", targetType: "COMMENT", targetId: "comment_demo_2", reason: "VERIFY_SOURCE", details: "Please confirm that the linked deadline still matches the latest circular.", status: "OPEN", createdAt: "2026-09-11T07:30:00.000Z" }
];

export async function isUsernameTaken(username: string) {
  const normalized = username.trim().toLowerCase();
  if (config.demoMode) return demoUsers.some((user) => user.username === normalized);
  return Boolean(await prisma!.user.findUnique({ where: { username: normalized }, select: { id: true } }));
}

export async function reserveFirebaseUser(input: {
  firebaseUid: string;
  username: string;
  email: string;
  displayName: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  const username = input.username.trim().toLowerCase();
  if (config.demoMode) {
    if (demoUsers.some((user) => user.username === username || user.email === input.email)) throw new UsernameConflictError();
    const user: UserRecord = { id: input.firebaseUid, username, email: input.email, displayName: input.displayName, phone: input.phone, role: "STUDENT", emailVerified: input.emailVerified, phoneVerified: input.phoneVerified };
    demoUsers.push(user);
    return user;
  }

  try {
    const user = await prisma!.user.create({
      data: {
        firebaseUid: input.firebaseUid,
        username,
        email: input.email,
        phone: input.phone,
        displayName: input.displayName,
        emailVerifiedAt: input.emailVerified ? new Date() : undefined,
        phoneVerifiedAt: input.phoneVerified ? new Date() : undefined
      }
    });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      phone: user.phone ?? undefined,
      role: user.role,
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt)
    } satisfies UserRecord;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new UsernameConflictError();
    throw error;
  }
}

export async function syncFirebaseUser(input: {
  firebaseUid: string;
  username?: string;
  email: string;
  displayName: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}) {
  const username = input.username?.trim().toLowerCase();
  if (config.demoMode) {
    const existing = demoUsers.find((user) => user.email === input.email);
    if (existing) {
      existing.displayName = input.displayName;
      existing.phone = input.phone;
      existing.emailVerified = input.emailVerified;
      existing.phoneVerified = input.phoneVerified;
      return existing;
    }
    if (!username) throw new Error("A username is required when creating an account");
    if (demoUsers.some((user) => user.username === username)) throw new UsernameConflictError();
    const user: UserRecord = { id: input.firebaseUid, username, email: input.email, displayName: input.displayName, phone: input.phone, role: "STUDENT", emailVerified: input.emailVerified, phoneVerified: input.phoneVerified };
    demoUsers.push(user);
    return user;
  }

  const existing = await prisma!.user.findFirst({ where: { OR: [{ firebaseUid: input.firebaseUid }, { email: input.email }] } });
  if (!existing && !username) throw new Error("A username is required when creating an account");
  if (existing?.firebaseUid && existing.firebaseUid !== input.firebaseUid) {
    throw new Error("This email is already linked to a different Firebase identity.");
  }

  let user;
  try {
    user = existing ? await prisma!.user.update({
      where: { id: existing.id },
      data: {
        firebaseUid: input.firebaseUid,
        email: input.email,
        displayName: input.displayName,
        phone: input.phone,
        emailVerifiedAt: input.emailVerified ? new Date() : undefined,
        phoneVerifiedAt: input.phoneVerified ? new Date() : undefined
      }
    }) : await prisma!.user.create({
      data: {
        firebaseUid: input.firebaseUid,
        username: username!,
        email: input.email,
        phone: input.phone,
        displayName: input.displayName,
        emailVerifiedAt: input.emailVerified ? new Date() : undefined,
        phoneVerifiedAt: input.phoneVerified ? new Date() : undefined
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new UsernameConflictError();
    throw error;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    phone: user.phone ?? undefined,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt)
  } satisfies UserRecord;
}

export async function createDemoSessionUser(username: string, admin = false) {
  const normalized = username.trim().toLowerCase();
  const existing = demoUsers.find((user) => user.username === normalized);
  if (existing) return existing;
  const user: UserRecord = {
    id: `user_demo_${Date.now()}`,
    username: normalized,
    email: `${normalized}@demo.edupath.local`,
    displayName: admin ? "EduPath Admin" : "Demo Student",
    role: admin ? "ADMIN" : "STUDENT",
    emailVerified: true,
    phoneVerified: true
  };
  demoUsers.push(user);
  return user;
}

export async function getUserIdentityForDeletion(userId: string) {
  if (config.demoMode) {
    const user = demoUsers.find((item) => item.id === userId);
    if (!user) throw new Error("User not found");
    return { firebaseUid: null, email: user.email };
  }
  const user = await prisma!.user.findUnique({ where: { id: userId }, select: { firebaseUid: true, email: true } });
  if (!user) throw new Error("User not found");
  return user;
}

export async function deleteUserAccountData(userId: string) {
  if (config.demoMode) {
    const index = demoUsers.findIndex((item) => item.id === userId);
    if (index < 0) throw new Error("User not found");
    demoUsers.splice(index, 1);
    demoSavedInstitutions.delete(userId);
    demoProfiles.delete(userId);
    demoApplications.delete(userId);
    for (let index = demoAiInteractions.length - 1; index >= 0; index -= 1) if (demoAiInteractions[index]!.userId === userId) demoAiInteractions.splice(index, 1);
    for (let index = demoContentReports.length - 1; index >= 0; index -= 1) if (demoContentReports[index]!.reporterId === userId) demoContentReports.splice(index, 1);
    const deletedCommentIds = new Set<string>();
    for (let index = demoComments.length - 1; index >= 0; index -= 1) {
      if (demoComments[index]!.author.id === userId) { deletedCommentIds.add(demoComments[index]!.id); demoComments.splice(index, 1); }
    }
    for (const commentId of deletedCommentIds) demoVotes.delete(commentId);
    for (const votes of demoVotes.values()) votes.delete(userId);
    for (const ratings of demoRatings.values()) ratings.delete(userId);
    return;
  }
  await prisma!.user.delete({ where: { id: userId } });
}

function profileCompletion(input: Omit<StudentProfileRecord, "profileCompleted" | "updatedAt">) {
  const checks = [input.level, input.group, input.interest, input.location, input.sscGpa >= 0, input.level === "SSC" || input.hscGpa >= 0];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function displayStage(value: string): StudentProfileRecord["level"] {
  if (value === "UNDERGRADUATE") return "Undergraduate";
  if (value === "GRADUATE") return "Graduate";
  if (value === "DIPLOMA") return "Diploma";
  return value === "SSC" ? "SSC" : "HSC";
}

function databaseStage(value: StudentProfileRecord["level"]) {
  return value.toUpperCase();
}

function toStudentProfileRecord(profile: { currentStage: string; academicGroup: string | null; sscGpa: Prisma.Decimal | null; hscGpa: Prisma.Decimal | null; graduationCgpa: Prisma.Decimal | null; interests: string[]; preferredDistricts: string[]; homeDistrictId: string | null; homeUpazilaId: string | null; preferredScope: string; preferredPathways: string[]; subjectResults: Prisma.JsonValue | null; profileCompleted: number; updatedAt: Date }): StudentProfileRecord {
  return {
    level: displayStage(profile.currentStage),
    group: (["Science", "Business Studies", "Humanities", "Vocational"] as const).includes(profile.academicGroup as StudentProfileRecord["group"]) ? profile.academicGroup as StudentProfileRecord["group"] : "Science",
    sscGpa: profile.sscGpa === null ? 0 : Number(profile.sscGpa),
    hscGpa: profile.hscGpa === null ? 0 : Number(profile.hscGpa),
    graduationCgpa: profile.graduationCgpa === null ? undefined : Number(profile.graduationCgpa),
    interest: profile.interests[0] ?? "Engineering & Technology",
    location: profile.preferredDistricts[0] ?? "Any district",
    homeDistrictId: profile.homeDistrictId ?? undefined,
    homeUpazilaId: profile.homeUpazilaId ?? undefined,
    preferredScope: profile.preferredScope as StudentProfileRecord["preferredScope"],
    preferredPathways: profile.preferredPathways,
    subjectResults: profile.subjectResults && typeof profile.subjectResults === "object" && !Array.isArray(profile.subjectResults) ? profile.subjectResults as Record<string, number> : undefined,
    profileCompleted: profile.profileCompleted,
    updatedAt: profile.updatedAt.toISOString()
  };
}

export async function getStudentProfile(userId: string): Promise<StudentProfileRecord | null> {
  if (config.demoMode) return demoProfiles.get(userId) ?? null;
  const profile = await prisma!.studentProfile.findUnique({ where: { userId } });
  return profile ? toStudentProfileRecord(profile) : null;
}

export async function upsertStudentProfile(userId: string, input: Omit<StudentProfileRecord, "profileCompleted" | "updatedAt">): Promise<StudentProfileRecord> {
  const normalized = { ...input, sscGpa: Number(input.sscGpa), hscGpa: Number(input.hscGpa), graduationCgpa: input.graduationCgpa === undefined ? undefined : Number(input.graduationCgpa) };
  const completed = profileCompletion(normalized);
  if (config.demoMode) {
    const record: StudentProfileRecord = { ...normalized, profileCompleted: completed, updatedAt: new Date().toISOString() };
    demoProfiles.set(userId, record);
    return record;
  }
  const profile = await prisma!.studentProfile.upsert({
    where: { userId },
    create: { userId, currentStage: databaseStage(normalized.level), academicGroup: normalized.group, sscGpa: normalized.sscGpa, hscGpa: normalized.hscGpa, graduationCgpa: normalized.graduationCgpa, interests: [normalized.interest], preferredDistricts: normalized.location === "Any district" ? [] : [normalized.location], homeDistrictId: normalized.homeDistrictId, homeUpazilaId: normalized.homeUpazilaId, preferredScope: normalized.preferredScope, preferredPathways: normalized.preferredPathways as never, subjectResults: normalized.subjectResults, careerGoals: [], profileCompleted: completed },
    update: { currentStage: databaseStage(normalized.level), academicGroup: normalized.group, sscGpa: normalized.sscGpa, hscGpa: normalized.hscGpa, graduationCgpa: normalized.graduationCgpa, interests: [normalized.interest], preferredDistricts: normalized.location === "Any district" ? [] : [normalized.location], homeDistrictId: normalized.homeDistrictId, homeUpazilaId: normalized.homeUpazilaId, preferredScope: normalized.preferredScope, preferredPathways: normalized.preferredPathways as never, subjectResults: normalized.subjectResults, profileCompleted: completed }
  });
  return toStudentProfileRecord(profile);
}

export async function exportUserData(userId: string) {
  const exportedAt = new Date().toISOString();
  if (config.demoMode) {
    const user = demoUsers.find((item) => item.id === userId);
    if (!user) throw new Error("User not found");
    const savedIds = [...(demoSavedInstitutions.get(userId) ?? new Set<string>())];
    const ratings = [...demoRatings.entries()].flatMap(([institutionId, values]) => values.has(userId) ? [{ institutionId, score: values.get(userId) }] : []);
    return { schemaVersion: "1.0", exportedAt, user, profile: demoProfiles.get(userId) ?? null, savedInstitutions: demoInstitutions.filter((item) => savedIds.includes(item.id)), applications: demoApplications.get(userId) ?? [], comments: demoComments.filter((item) => item.author.id === userId), ratings, aiInteractions: demoAiInteractions.filter((item) => item.userId === userId), contentReports: demoContentReports.filter((item) => item.reporterId === userId) };
  }
  const user = await prisma!.user.findUnique({
    where: { id: userId },
    include: { profile: true, applications: { include: { documents: true, program: { select: { id: true, name: true, institution: { select: { id: true, name: true } } } } } }, savedItems: true, discussionPosts: true, comments: true, votes: true, ratings: true, notifications: true, aiInteractions: true, contentReports: true }
  });
  if (!user) throw new Error("User not found");
  const { firebaseUid: _firebaseUid, ...portableUser } = user;
  return { schemaVersion: "1.0", exportedAt, user: portableUser };
}

export async function listLocations(districtCode?: string) {
  if (config.demoMode) {
    return bangladeshDivisions.map((division) => ({
      id: `division_${division.slug}`,
      code: division.code,
      slug: division.slug,
      name: division.name,
      nameBn: division.nameBn,
      districts: division.districts
        .filter((district) => !districtCode || district.code === districtCode)
        .map((district) => ({ id: `district_${district.slug}`, ...district, upazilas: [] }))
    })).filter((division) => division.districts.length || !districtCode);
  }
  return prisma!.division.findMany({
    orderBy: { name: "asc" },
    include: {
      districts: {
        where: districtCode ? { code: districtCode } : undefined,
        orderBy: { name: "asc" },
        include: { upazilas: { orderBy: { name: "asc" }, select: { id: true, code: true, slug: true, name: true, nameBn: true } } }
      }
    }
  });
}

export async function validateLocationSelection(districtId?: string, upazilaId?: string) {
  if (!upazilaId) return !districtId || Boolean((await listLocations()).some((division) => division.districts.some((district) => district.id === districtId)));
  if (!districtId) return false;
  if (config.demoMode) return false;
  return Boolean(await prisma!.upazila.findFirst({ where: { id: upazilaId, districtId }, select: { id: true } }));
}

export async function listInstitutions(options: { search?: string; type?: InstitutionType; district?: string; districtCode?: string; upazilaCode?: string; page?: number; limit?: number } = {}) {
  const normalized = options.search?.trim().toLowerCase() ?? "";
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const district = options.district?.trim().toLowerCase();
  if (config.demoMode) {
    const filtered = demoInstitutions.filter((item) =>
      item.verified &&
      (!normalized || item.name.toLowerCase().includes(normalized) || item.district.toLowerCase().includes(normalized)) &&
      (!options.type || item.type === options.type) &&
      (!district || item.district.toLowerCase() === district) &&
      !options.upazilaCode
    );
    return { data: filtered.slice((page - 1) * limit, page * limit).map((item) => ({ ...item, programCount: demoPrograms.filter((program) => program.institutionId === item.id && program.verified).length })), total: filtered.length };
  }

  const where = {
    verificationStatus: "VERIFIED" as const,
    ...(normalized ? { OR: [{ name: { contains: normalized, mode: "insensitive" as const } }, { district: { contains: normalized, mode: "insensitive" as const } }] } : {}),
    ...(options.type ? { type: options.type } : {}),
    ...(options.district ? { district: { equals: options.district, mode: "insensitive" as const } } : {}),
    ...(options.districtCode ? { districtRef: { code: options.districtCode } } : {}),
    ...(options.upazilaCode ? { upazila: { code: options.upazilaCode } } : {})
  };
  const [data, total] = await Promise.all([
    prisma!.institution.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: "asc" }, include: { division: { select: { name: true } }, districtRef: { select: { name: true } }, upazila: { select: { name: true } }, _count: { select: { programs: { where: { verificationStatus: "VERIFIED" } } } } } }),
    prisma!.institution.count({ where })
  ]);
  return {
    data: data.map((item) => ({ id: item.id, name: item.name, slug: item.slug, type: item.type, district: item.districtRef?.name ?? item.district, division: item.division?.name, upazila: item.upazila?.name, officialCode: item.officialCode ?? undefined, description: item.description ?? undefined, websiteUrl: item.websiteUrl ?? undefined, sourceUrl: item.sourceUrl ?? undefined, verified: item.verificationStatus === "VERIFIED", programCount: item._count.programs })),
    total
  };
}

export async function getInstitution(id: string) {
  if (config.demoMode) {
    const item = demoInstitutions.find((institution) => institution.id === id && institution.verified);
    return item ? { ...item, programCount: demoPrograms.filter((program) => program.institutionId === item.id && program.verified).length } : null;
  }
  const item = await prisma!.institution.findFirst({ where: { id, verificationStatus: "VERIFIED" }, include: { _count: { select: { programs: { where: { verificationStatus: "VERIFIED" } } } } } });
  if (!item) return null;
  return { id: item.id, name: item.name, slug: item.slug, type: item.type, district: item.district, description: item.description ?? undefined, websiteUrl: item.websiteUrl ?? undefined, sourceUrl: item.sourceUrl ?? undefined, verified: item.verificationStatus === "VERIFIED", programCount: item._count.programs };
}

export async function createInstitution(input: Omit<InstitutionRecord, "id" | "verified" | "programCount">) {
  if (config.demoMode) {
    const institution: InstitutionRecord = { id: `inst_${Date.now()}`, ...input, verified: false, programCount: 0 };
    demoInstitutions.push(institution);
    demoVerificationStatuses.set(`INSTITUTION:${institution.id}`, "DRAFT");
    return institution;
  }
  const institution = await prisma!.institution.create({
    data: { name: input.name, slug: input.slug, type: input.type, district: input.district, description: input.description, websiteUrl: input.websiteUrl, sourceUrl: input.sourceUrl, officialCode: input.officialCode, verificationStatus: "DRAFT" }
  });
  return { id: institution.id, name: institution.name, slug: institution.slug, type: institution.type, district: institution.district, description: institution.description ?? undefined, websiteUrl: institution.websiteUrl ?? undefined, sourceUrl: institution.sourceUrl ?? undefined, verified: false, programCount: 0 };
}

export async function listPrograms(options: { search?: string; institutionId?: string; institutionType?: InstitutionType; district?: string; districtCode?: string; upazilaCode?: string; level?: string; group?: string; page?: number; limit?: number } = {}) {
  const search = options.search?.trim().toLowerCase() ?? "";
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  if (config.demoMode) {
    const filtered = demoPrograms.filter((item) =>
      item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified && (!options.institutionType || institution.type === options.institutionType) && (!options.district || institution.district.toLowerCase() === options.district.toLowerCase())) &&
      (!search || item.name.toLowerCase().includes(search) || item.institutionName.toLowerCase().includes(search)) &&
      (!options.institutionId || item.institutionId === options.institutionId) &&
      !options.districtCode && !options.upazilaCode &&
      (!options.level || item.level.toLowerCase() === options.level.toLowerCase()) &&
      (!options.group || item.groups.includes(options.group))
    );
    return {
      data: filtered.slice((page - 1) * limit, page * limit).map((item) => ({
        ...item,
        sourceUrl: item.sourceUrl ?? demoInstitutions.find((institution) => institution.id === item.institutionId)?.sourceUrl
      })),
      total: filtered.length
    };
  }

  const where = {
    verificationStatus: "VERIFIED" as const,
    institution: {
      verificationStatus: "VERIFIED" as const,
      ...(options.institutionType ? { type: options.institutionType } : {}),
      ...(options.district ? { district: { equals: options.district, mode: "insensitive" as const } } : {}),
      ...(options.districtCode ? { districtRef: { code: options.districtCode } } : {}),
      ...(options.upazilaCode ? { upazila: { code: options.upazilaCode } } : {})
    },
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { institution: { name: { contains: search, mode: "insensitive" as const } } }] } : {}),
    ...(options.institutionId ? { institutionId: options.institutionId } : {}),
    ...(options.level ? { level: { equals: options.level, mode: "insensitive" as const } } : {}),
    ...(options.group ? { admissionRules: { some: { allowedGroups: { has: options.group } } } } : {})
  };
  const [data, total] = await Promise.all([
    prisma!.program.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { name: "asc" }, include: { institution: { select: { name: true } }, admissionRules: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma!.program.count({ where })
  ]);
  const mapped = data.map((item) => {
    const rule = item.admissionRules[0];
    return { id: item.id, institutionId: item.institutionId, institutionName: item.institution.name, name: item.name, slug: item.slug, level: item.level, pathwayCategory: item.pathwayCategory, entryStage: item.entryStage ?? undefined, subjectAreas: item.subjectAreas, durationMonths: item.durationMonths ?? undefined, tuitionMin: item.tuitionMin ?? undefined, tuitionMax: item.tuitionMax ?? undefined, groups: rule?.allowedGroups.length ? rule.allowedGroups : item.availableGroups, minimumGpa: Number(rule?.minimumCombinedGpa ?? rule?.minimumHscGpa ?? rule?.minimumSscGpa ?? 0), careerOutcomes: item.careerOutcomes, sourceUrl: item.sourceUrl ?? undefined, verified: item.verificationStatus === "VERIFIED" } satisfies ProgramRecord;
  });
  return { data: mapped, total };
}

export async function listEligibilityRules(): Promise<AdmissionRuleRecord[]> {
  if (config.demoMode) {
    return demoPrograms.filter((program) => program.verified).map((program) => {
      const institution = demoInstitutions.find((item) => item.id === program.institutionId)!;
      const applicantStage = program.level === "Diploma" || program.level === "Certificate" ? "SSC" : "HSC";
      return {
        id: `rule_${program.id}_2026_27`,
        programId: program.id,
        programName: program.name,
        institutionName: program.institutionName,
        institutionType: institution.type,
        academicSession: "2026-27",
        applicantStage,
        allowedGroups: program.groups.map((group) => group.toUpperCase().replaceAll(" ", "_")),
        ...(applicantStage === "SSC" ? { minimumSscGpa: program.minimumGpa } : { minimumHscGpa: program.minimumGpa }),
        sourceUrl: institution.sourceUrl ?? institution.websiteUrl ?? "https://moedu.gov.bd"
      };
    });
  }

  const now = new Date();
  const rows = await prisma!.admissionRule.findMany({
    where: {
      program: { verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } },
      AND: [
        { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
        { OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }] }
      ]
    },
    orderBy: [{ academicSession: "desc" }, { updatedAt: "desc" }],
    include: { program: { select: { name: true, institution: { select: { name: true, type: true } } } } }
  });
  const latestByProgram = new Map<string, AdmissionRuleRecord>();
  for (const row of rows) {
    if (latestByProgram.has(row.programId)) continue;
    latestByProgram.set(row.programId, {
      id: row.id,
      programId: row.programId,
      programName: row.program.name,
      institutionName: row.program.institution.name,
      institutionType: row.program.institution.type,
      academicSession: row.academicSession,
      applicantStage: row.applicantStage,
      allowedGroups: row.allowedGroups,
      minimumSscGpa: row.minimumSscGpa === null ? undefined : Number(row.minimumSscGpa),
      minimumHscGpa: row.minimumHscGpa === null ? undefined : Number(row.minimumHscGpa),
      minimumCombinedGpa: row.minimumCombinedGpa === null ? undefined : Number(row.minimumCombinedGpa),
      requiredSubjects: Array.isArray(row.requiredSubjects) ? row.requiredSubjects.filter((value): value is string => typeof value === "string") : undefined,
      minimumSubjectGrades: row.minimumSubjectGrades && typeof row.minimumSubjectGrades === "object" && !Array.isArray(row.minimumSubjectGrades) ? Object.fromEntries(Object.entries(row.minimumSubjectGrades).filter((entry): entry is [string, number] => typeof entry[1] === "number")) : undefined,
      additionalCriteria: row.additionalCriteria ?? undefined,
      sourceUrl: row.sourceUrl
    });
  }
  return [...latestByProgram.values()];
}

export async function listRecommendationCandidates(): Promise<RecommendationCandidateRecord[]> {
  const rules = await listEligibilityRules();
  const rulesByProgram = new Map<string, AdmissionRuleRecord[]>();
  for (const rule of rules) rulesByProgram.set(rule.programId, [...(rulesByProgram.get(rule.programId) ?? []), rule]);

  if (config.demoMode) {
    return demoPrograms.filter((program) => program.verified).map((program) => {
      const institution = demoInstitutions.find((item) => item.id === program.institutionId)!;
      return {
        id: program.id,
        name: program.name,
        level: program.level,
        pathwayCategory: program.level === "Diploma" ? "POLYTECHNIC_DIPLOMA" : institution.type === "MEDICAL" ? "MEDICAL_DENTAL" : institution.type === "ENGINEERING" ? "ENGINEERING" : "UNIVERSITY_GENERAL",
        entryStage: program.level === "Diploma" || program.level === "Certificate" ? "SSC" : "HSC",
        subjectAreas: [],
        availableGroups: program.groups,
        durationMonths: program.durationMonths,
        tuitionMin: program.tuitionMin,
        tuitionMax: program.tuitionMax,
        careerOutcomes: program.careerOutcomes,
        sourceUrl: program.sourceUrl ?? institution.sourceUrl,
        institution: { id: institution.id, name: institution.name, type: institution.type, district: institution.district, sourceUrl: institution.sourceUrl },
        admissionRules: rulesByProgram.get(program.id) ?? []
      };
    });
  }

  const programs = await prisma!.program.findMany({
    where: { verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } },
    orderBy: [{ institution: { name: "asc" } }, { name: "asc" }],
    include: {
      institution: {
        select: {
          id: true,
          name: true,
          type: true,
          district: true,
          sourceUrl: true,
          districtRef: { select: { code: true, name: true } },
          upazila: { select: { code: true, name: true } }
        }
      }
    }
  });
  return programs.map((program) => ({
    id: program.id,
    name: program.name,
    level: program.level,
    pathwayCategory: program.pathwayCategory,
    entryStage: program.entryStage ?? undefined,
    subjectAreas: program.subjectAreas,
    availableGroups: program.availableGroups,
    durationMonths: program.durationMonths ?? undefined,
    tuitionMin: program.tuitionMin ?? undefined,
    tuitionMax: program.tuitionMax ?? undefined,
    careerOutcomes: program.careerOutcomes,
    sourceUrl: program.sourceUrl ?? undefined,
    institution: {
      id: program.institution.id,
      name: program.institution.name,
      type: program.institution.type,
      districtCode: program.institution.districtRef?.code,
      district: program.institution.districtRef?.name ?? program.institution.district,
      upazilaCode: program.institution.upazila?.code,
      upazila: program.institution.upazila?.name,
      sourceUrl: program.institution.sourceUrl ?? undefined
    },
    admissionRules: rulesByProgram.get(program.id) ?? []
  }));
}

export async function listScholarships(options: { gpa?: number; group?: string; level?: string; page?: number; limit?: number } = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const matches = (item: ScholarshipRecord) =>
    (options.gpa === undefined || item.minimumGpa === undefined || options.gpa >= item.minimumGpa)
    && (!options.group || !item.groups.length || item.groups.some((group) => group.toUpperCase().replaceAll(" ", "_") === options.group!.toUpperCase().replaceAll(" ", "_")))
    && (!options.level || !item.levels.length || item.levels.some((level) => level.toUpperCase() === options.level!.toUpperCase()));

  if (config.demoMode) {
    const filtered = demoScholarships.filter((item) => item.verified && matches(item));
    return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
  }

  const rows = await prisma!.scholarship.findMany({
    where: { verificationStatus: "VERIFIED" },
    orderBy: [{ deadline: "asc" }, { title: "asc" }],
    include: { institution: { select: { name: true } }, program: { select: { name: true } } }
  });
  const mapped = rows.map((item) => {
    const eligibility = typeof item.eligibility === "object" && item.eligibility && !Array.isArray(item.eligibility) ? item.eligibility as Record<string, unknown> : {};
    return {
      id: item.id,
      title: item.title,
      provider: item.provider,
      description: item.description ?? undefined,
      institutionName: item.institution?.name,
      programName: item.program?.name,
      minimumGpa: typeof eligibility.minimumGpa === "number" ? eligibility.minimumGpa : undefined,
      groups: Array.isArray(eligibility.groups) ? eligibility.groups.filter((value): value is string => typeof value === "string") : [],
      levels: Array.isArray(eligibility.levels) ? eligibility.levels.filter((value): value is string => typeof value === "string") : [],
      amountDescription: item.amountDescription ?? undefined,
      deadline: item.deadline?.toISOString(),
      sourceUrl: item.sourceUrl,
      verified: true
    } satisfies ScholarshipRecord;
  }).filter(matches);
  return { data: mapped.slice((page - 1) * limit, page * limit), total: mapped.length };
}

export async function createProgram(input: { institutionId: string; name: string; slug: string; level: string; durationMonths?: number; tuitionMin?: number; tuitionMax?: number; careerOutcomes: string[] }) {
  if (config.demoMode) {
    const institution = demoInstitutions.find((item) => item.id === input.institutionId);
    if (!institution) throw new Error("Institution not found");
    const program: ProgramRecord = { id: `prog_${Date.now()}`, institutionId: input.institutionId, institutionName: institution.name, name: input.name, slug: input.slug, level: input.level, durationMonths: input.durationMonths, tuitionMin: input.tuitionMin, tuitionMax: input.tuitionMax, careerOutcomes: input.careerOutcomes, groups: [], minimumGpa: 0, verified: false };
    demoPrograms.push(program);
    demoVerificationStatuses.set(`PROGRAM:${program.id}`, "DRAFT");
    institution.programCount += 1;
    return program;
  }
  const program = await prisma!.program.create({ data: { ...input, verificationStatus: "DRAFT" }, include: { institution: { select: { name: true } } } });
  return { id: program.id, institutionId: program.institutionId, institutionName: program.institution.name, name: program.name, slug: program.slug, level: program.level, durationMonths: program.durationMonths ?? undefined, tuitionMin: program.tuitionMin ?? undefined, tuitionMax: program.tuitionMax ?? undefined, careerOutcomes: program.careerOutcomes, groups: [], minimumGpa: 0, verified: false } satisfies ProgramRecord;
}

export async function listCirculars(options: { from?: Date; to?: Date; page?: number; limit?: number } = {}) {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  if (config.demoMode) {
    const filtered = demoCirculars.filter((item) => item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified) && (!options.from || new Date(item.applicationEndsAt) >= options.from) && (!options.to || new Date(item.applicationEndsAt) <= options.to));
    return { data: filtered.slice((page - 1) * limit, page * limit), total: filtered.length };
  }
  const where = { verificationStatus: "VERIFIED" as const, institution: { verificationStatus: "VERIFIED" as const }, applicationEndsAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } };
  const [data, total] = await Promise.all([
    prisma!.circular.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { applicationEndsAt: "asc" }, include: { institution: { select: { name: true } } } }),
    prisma!.circular.count({ where })
  ]);
  return { data: data.map((item) => ({ id: item.id, institutionId: item.institutionId, institutionName: item.institution.name, title: item.title, academicSession: item.academicSession, applicationStartsAt: item.applicationStartsAt?.toISOString(), applicationEndsAt: item.applicationEndsAt.toISOString(), examAt: item.examAt?.toISOString(), applicationFee: item.applicationFee ?? undefined, sourceUrl: item.sourceUrl, verified: item.verificationStatus === "VERIFIED" })), total };
}

export async function createCircular(input: { institutionId: string; programId?: string; title: string; academicSession: string; applicationStartsAt?: Date; applicationEndsAt: Date; examAt?: Date; applicationFee?: number; sourceUrl: string }) {
  if (config.demoMode) {
    const institution = demoInstitutions.find((item) => item.id === input.institutionId);
    if (!institution) throw new Error("Institution not found");
    const circular: CircularRecord = { id: `circ_${Date.now()}`, institutionId: input.institutionId, institutionName: institution.name, title: input.title, academicSession: input.academicSession, applicationStartsAt: input.applicationStartsAt?.toISOString(), applicationEndsAt: input.applicationEndsAt.toISOString(), examAt: input.examAt?.toISOString(), applicationFee: input.applicationFee, sourceUrl: input.sourceUrl, verified: false };
    demoCirculars.push(circular);
    demoVerificationStatuses.set(`CIRCULAR:${circular.id}`, "PENDING");
    return circular;
  }
  const circular = await prisma!.circular.create({ data: { ...input, verificationStatus: "PENDING" }, include: { institution: { select: { name: true } } } });
  return { id: circular.id, institutionId: circular.institutionId, institutionName: circular.institution.name, title: circular.title, academicSession: circular.academicSession, applicationStartsAt: circular.applicationStartsAt?.toISOString(), applicationEndsAt: circular.applicationEndsAt.toISOString(), examAt: circular.examAt?.toISOString(), applicationFee: circular.applicationFee ?? undefined, sourceUrl: circular.sourceUrl, verified: false } satisfies CircularRecord;
}

export async function listSavedInstitutions(userId: string) {
  if (config.demoMode) {
    const ids = demoSavedInstitutions.get(userId) ?? new Set<string>();
    return demoInstitutions.filter((item) => item.verified && ids.has(item.id)).map((item) => ({ ...item, programCount: demoPrograms.filter((program) => program.institutionId === item.id && program.verified).length }));
  }
  const saved = await prisma!.savedItem.findMany({ where: { userId, itemType: "INSTITUTION" }, orderBy: { createdAt: "desc" } });
  const institutions = await prisma!.institution.findMany({ where: { id: { in: saved.map((item) => item.itemId) }, verificationStatus: "VERIFIED" }, include: { _count: { select: { programs: { where: { verificationStatus: "VERIFIED" } } } } } });
  const byId = new Map(institutions.map((item) => [item.id, item]));
  return saved.flatMap((savedItem) => {
    const item = byId.get(savedItem.itemId);
    return item ? [{ id: item.id, name: item.name, slug: item.slug, type: item.type, district: item.district, description: item.description ?? undefined, websiteUrl: item.websiteUrl ?? undefined, sourceUrl: item.sourceUrl ?? undefined, verified: item.verificationStatus === "VERIFIED", programCount: item._count.programs } satisfies InstitutionRecord] : [];
  });
}

export async function saveInstitution(userId: string, institutionId: string) {
  if (config.demoMode) {
    if (!demoInstitutions.some((item) => item.id === institutionId && item.verified)) throw new Error("Verified institution not found");
    const saved = demoSavedInstitutions.get(userId) ?? new Set<string>();
    saved.add(institutionId);
    demoSavedInstitutions.set(userId, saved);
    return { saved: true, institutionId };
  }
  const institution = await prisma!.institution.findFirst({ where: { id: institutionId, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!institution) throw new Error("Verified institution not found");
  await prisma!.savedItem.upsert({
    where: { userId_itemType_itemId: { userId, itemType: "INSTITUTION", itemId: institutionId } },
    create: { userId, itemType: "INSTITUTION", itemId: institutionId },
    update: {}
  });
  return { saved: true, institutionId };
}

export async function removeSavedInstitution(userId: string, institutionId: string) {
  if (config.demoMode) {
    demoSavedInstitutions.get(userId)?.delete(institutionId);
    return { saved: false, institutionId };
  }
  await prisma!.savedItem.deleteMany({ where: { userId, itemType: "INSTITUTION", itemId: institutionId } });
  return { saved: false, institutionId };
}

const checklistTitles = ["Applicant photo", "Academic transcript", "Registration card", "Identity or birth certificate"];

export async function listApplications(userId: string): Promise<ApplicationRecord[]> {
  if (config.demoMode) return demoApplications.get(userId) ?? [];
  const applications = await prisma!.application.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, include: { program: { include: { institution: { select: { name: true } } } }, documents: true } });
  return applications.map((item) => ({ id: item.id, programId: item.programId, programName: item.program.name, institutionName: item.program.institution.name, status: item.status, notes: item.notes ?? undefined, updatedAt: item.updatedAt.toISOString(), documents: item.documents.map((document) => ({ id: document.id, title: document.title, isRequired: document.isRequired, isCompleted: document.isCompleted })) }));
}

export async function startApplication(userId: string, programId: string) {
  if (config.demoMode) {
    const program = demoPrograms.find((item) => item.id === programId && item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified));
    if (!program) throw new Error("Verified program not found");
    const existing = (demoApplications.get(userId) ?? []).find((item) => item.programId === programId);
    if (existing) return existing;
    const application: ApplicationRecord = { id: `app_${Date.now()}`, programId, programName: program.name, institutionName: program.institutionName, status: "INTERESTED", updatedAt: new Date().toISOString(), documents: checklistTitles.map((title, index) => ({ id: `doc_${Date.now()}_${index}`, title, isRequired: true, isCompleted: false })) };
    demoApplications.set(userId, [application, ...(demoApplications.get(userId) ?? [])]);
    return application;
  }
  const program = await prisma!.program.findFirst({ where: { id: programId, verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } }, select: { id: true } });
  if (!program) throw new Error("Verified program not found");
  await prisma!.application.upsert({
    where: { userId_programId: { userId, programId } },
    create: { userId, programId, documents: { create: checklistTitles.map((title) => ({ title })) } },
    update: {}
  });
  return (await listApplications(userId)).find((item) => item.programId === programId)!;
}

export async function updateApplicationStatus(userId: string, applicationId: string, status: ApplicationStatus) {
  if (config.demoMode) {
    const application = (demoApplications.get(userId) ?? []).find((item) => item.id === applicationId);
    if (!application) throw new Error("Application not found");
    application.status = status;
    application.updatedAt = new Date().toISOString();
    return application;
  }
  await prisma!.application.updateMany({ where: { id: applicationId, userId }, data: { status, appliedAt: status === "APPLIED" ? new Date() : undefined } });
  const application = (await listApplications(userId)).find((item) => item.id === applicationId);
  if (!application) throw new Error("Application not found");
  return application;
}

export async function toggleApplicationDocument(userId: string, applicationId: string, documentId: string, completed: boolean) {
  if (config.demoMode) {
    const application = (demoApplications.get(userId) ?? []).find((item) => item.id === applicationId);
    const document = application?.documents.find((item) => item.id === documentId);
    if (!application || !document) throw new Error("Checklist item not found");
    document.isCompleted = completed;
    application.updatedAt = new Date().toISOString();
    return application;
  }
  const owned = await prisma!.application.findFirst({ where: { id: applicationId, userId }, select: { id: true } });
  if (!owned) throw new Error("Application not found");
  await prisma!.applicationDocument.updateMany({ where: { id: documentId, applicationId }, data: { isCompleted: completed } });
  return (await listApplications(userId)).find((item) => item.id === applicationId)!;
}

export async function getInstitutionDiscussion(institutionId: string) {
  if (config.demoMode) return demoInstitutions.some((item) => item.id === institutionId && item.verified) ? demoDiscussions.find((item) => item.institutionId === institutionId) ?? null : null;
  const post = await prisma!.discussionPost.findFirst({ where: { institutionId, institution: { verificationStatus: "VERIFIED" } }, orderBy: { createdAt: "asc" } });
  return post ? { id: post.id, institutionId: post.institutionId!, title: post.title, body: post.body, createdAt: post.createdAt.toISOString() } satisfies DiscussionRecord : null;
}

export async function createInstitutionDiscussion(authorId: string, institutionId: string, title: string, body: string) {
  const existing = await getInstitutionDiscussion(institutionId);
  if (existing) return existing;
  if (config.demoMode) {
    if (!demoInstitutions.some((item) => item.id === institutionId && item.verified)) throw new Error("Verified institution not found");
    const post: DiscussionRecord = { id: `post_${Date.now()}`, institutionId, title, body, createdAt: new Date().toISOString() };
    demoDiscussions.push(post);
    return post;
  }
  const institution = await prisma!.institution.findFirst({ where: { id: institutionId, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!institution) throw new Error("Verified institution not found");
  const post = await prisma!.discussionPost.create({ data: { authorId, institutionId, title, body } });
  return { id: post.id, institutionId: post.institutionId!, title: post.title, body: post.body, createdAt: post.createdAt.toISOString() } satisfies DiscussionRecord;
}

export async function listDiscussionComments(postId: string, userId: string | undefined, page = 1, limit = 20) {
  if (config.demoMode) {
    const all = demoComments.filter((item) => item.postId === postId);
    const data = all.slice((page - 1) * limit, page * limit).map((item) => {
      const votes = demoVotes.get(item.id) ?? new Map<string, VoteType>();
      return { ...item, likes: [...votes.values()].filter((vote) => vote === "LIKE").length, dislikes: [...votes.values()].filter((vote) => vote === "DISLIKE").length, userVote: userId ? votes.get(userId) : undefined };
    });
    return { data, total: all.length };
  }
  const [comments, total] = await Promise.all([
    prisma!.comment.findMany({ where: { postId, isHidden: false }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true, displayName: true, role: true } }, votes: true } }),
    prisma!.comment.count({ where: { postId, isHidden: false } })
  ]);
  return {
    data: comments.map((item) => ({ id: item.id, postId: item.postId, parentId: item.parentId ?? undefined, body: item.body, isVerified: item.isVerified, createdAt: item.createdAt.toISOString(), author: item.author, likes: item.votes.filter((vote) => vote.type === "LIKE").length, dislikes: item.votes.filter((vote) => vote.type === "DISLIKE").length, userVote: item.votes.find((vote) => vote.userId === userId)?.type } satisfies CommentRecord)),
    total
  };
}

export async function createDiscussionComment(postId: string, authorId: string, body: string, parentId?: string) {
  if (config.demoMode) {
    const author = demoUsers.find((item) => item.id === authorId);
    if (!author || !demoDiscussions.some((item) => item.id === postId)) throw new Error("Discussion or author not found");
    if (parentId && !demoComments.some((item) => item.id === parentId && item.postId === postId)) throw new Error("Parent comment not found");
    const comment: CommentRecord = { id: `comment_${Date.now()}`, postId, parentId, body, isVerified: author.role !== "STUDENT", createdAt: new Date().toISOString(), author: { id: author.id, username: author.username, displayName: author.displayName, role: author.role }, likes: 0, dislikes: 0 };
    demoComments.push(comment);
    return comment;
  }
  if (parentId) {
    const parent = await prisma!.comment.findFirst({ where: { id: parentId, postId }, select: { id: true } });
    if (!parent) throw new Error("Parent comment not found in this discussion");
  }
  const author = await prisma!.user.findUnique({ where: { id: authorId }, select: { role: true } });
  if (!author) throw new Error("Author not found");
  const comment = await prisma!.comment.create({ data: { postId, authorId, parentId, body, isVerified: author.role !== "STUDENT" }, include: { author: { select: { id: true, username: true, displayName: true, role: true } } } });
  return { id: comment.id, postId: comment.postId, parentId: comment.parentId ?? undefined, body: comment.body, isVerified: comment.isVerified, createdAt: comment.createdAt.toISOString(), author: comment.author, likes: 0, dislikes: 0 } satisfies CommentRecord;
}

export async function voteOnComment(commentId: string, userId: string, type: VoteType | null) {
  if (config.demoMode) {
    const comment = demoComments.find((item) => item.id === commentId);
    if (!comment) throw new Error("Comment not found");
    const votes = demoVotes.get(commentId) ?? new Map<string, VoteType>();
    if (type) votes.set(userId, type); else votes.delete(userId);
    demoVotes.set(commentId, votes);
    return { commentId, postId: comment.postId, likes: [...votes.values()].filter((vote) => vote === "LIKE").length, dislikes: [...votes.values()].filter((vote) => vote === "DISLIKE").length, userVote: type ?? undefined };
  }
  const comment = await prisma!.comment.findUnique({ where: { id: commentId }, select: { postId: true } });
  if (!comment) throw new Error("Comment not found");
  await prisma!.$transaction(async (database) => {
    if (!type) await database.commentVote.deleteMany({ where: { commentId, userId } });
    else await database.commentVote.upsert({ where: { commentId_userId: { commentId, userId } }, create: { commentId, userId, type }, update: { type } });
  });
  const [likes, dislikes] = await Promise.all([prisma!.commentVote.count({ where: { commentId, type: "LIKE" } }), prisma!.commentVote.count({ where: { commentId, type: "DISLIKE" } })]);
  return { commentId, postId: comment.postId, likes, dislikes, userVote: type ?? undefined };
}

export async function getInstitutionRating(institutionId: string, userId?: string): Promise<RatingSummary> {
  if (config.demoMode) {
    if (!demoInstitutions.some((item) => item.id === institutionId && item.verified)) throw new Error("Verified institution not found");
    const ratings = demoRatings.get(institutionId) ?? new Map<string, number>();
    const scores = [...ratings.values()];
    const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((score) => [String(score), scores.filter((item) => item === score).length]));
    return { average: scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)) : 0, count: scores.length, distribution, userScore: userId ? ratings.get(userId) : undefined };
  }
  const institution = await prisma!.institution.findFirst({ where: { id: institutionId, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!institution) throw new Error("Verified institution not found");
  const ratings = await prisma!.rating.findMany({ where: { institutionId }, select: { userId: true, score: true } });
  const distribution = Object.fromEntries([1, 2, 3, 4, 5].map((score) => [String(score), ratings.filter((item) => item.score === score).length]));
  return { average: ratings.length ? Number((ratings.reduce((sum, item) => sum + item.score, 0) / ratings.length).toFixed(1)) : 0, count: ratings.length, distribution, userScore: ratings.find((item) => item.userId === userId)?.score };
}

export async function rateInstitution(institutionId: string, userId: string, score: number, review?: string) {
  if (config.demoMode) {
    if (!demoInstitutions.some((item) => item.id === institutionId && item.verified)) throw new Error("Verified institution not found");
    const ratings = demoRatings.get(institutionId) ?? new Map<string, number>();
    ratings.set(userId, score);
    demoRatings.set(institutionId, ratings);
    return getInstitutionRating(institutionId, userId);
  }
  const institution = await prisma!.institution.findFirst({ where: { id: institutionId, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!institution) throw new Error("Verified institution not found");
  await prisma!.rating.upsert({ where: { userId_institutionId: { userId, institutionId } }, create: { userId, institutionId, score, review }, update: { score, review } });
  return getInstitutionRating(institutionId, userId);
}

export async function recordUploadedMedia(input: { institutionId?: string; title: string; url: string; mimeType: string }) {
  const type: MediaType = input.mimeType.startsWith("audio/") ? "AUDIO" : input.mimeType.startsWith("image/") ? "IMAGE" : "DOCUMENT";
  if (config.demoMode) {
    const item: MediaRecord = { id: `media_${Date.now()}`, institutionId: input.institutionId, institutionName: demoInstitutions.find((institution) => institution.id === input.institutionId)?.name, title: input.title, url: input.url, type, verified: false, updatedAt: new Date().toISOString() };
    demoMedia.unshift(item);
    return item;
  }
  const media = await prisma!.media.create({ data: { institutionId: input.institutionId, title: input.title, url: input.url, type, verificationStatus: "PENDING" } });
  return { id: media.id, institutionId: media.institutionId ?? undefined, title: media.title, url: media.url, type: media.type };
}

export async function listVerifiedMedia(institutionId: string): Promise<MediaRecord[]> {
  if (config.demoMode) {
    return demoMedia
      .filter((item) => (!item.institutionId || item.institutionId === institutionId) && item.verified && (item.type === "YOUTUBE" || item.type === "AUDIO"))
      .sort((left, right) => Number(Boolean(right.institutionId)) - Number(Boolean(left.institutionId)) || right.updatedAt.localeCompare(left.updatedAt));
  }
  const items = await prisma!.media.findMany({
    where: {
      type: { in: ["YOUTUBE", "AUDIO"] },
      verificationStatus: "VERIFIED",
      OR: [
        { institutionId: null },
        { institutionId, institution: { verificationStatus: "VERIFIED" } }
      ]
    },
    include: { institution: { select: { name: true } } },
    orderBy: { updatedAt: "desc" }
  });
  return items
    .map((item) => ({ id: item.id, institutionId: item.institutionId ?? undefined, institutionName: item.institution?.name, programId: item.programId ?? undefined, type: item.type, title: item.title, url: item.url, thumbnailUrl: item.thumbnailUrl ?? undefined, languageCode: item.languageCode === "en" || item.languageCode === "bn" ? item.languageCode : undefined, verified: true, updatedAt: item.updatedAt.toISOString() } satisfies MediaRecord))
    .sort((left, right) => Number(Boolean(right.institutionId)) - Number(Boolean(left.institutionId)) || right.updatedAt.localeCompare(left.updatedAt));
}

export async function createMediaResource(input: { institutionId?: string; type: "YOUTUBE" | "AUDIO"; title: string; url: string; thumbnailUrl?: string; languageCode?: "en" | "bn" }) {
  if (config.demoMode) {
    const institution = input.institutionId ? demoInstitutions.find((item) => item.id === input.institutionId) : undefined;
    if (input.institutionId && !institution) throw new Error("Institution not found");
    const item: MediaRecord = { id: `media_${Date.now()}`, institutionId: input.institutionId, institutionName: institution?.name, type: input.type, title: input.title, url: input.url, thumbnailUrl: input.thumbnailUrl, languageCode: input.languageCode, verified: false, updatedAt: new Date().toISOString() };
    demoMedia.unshift(item);
    return item;
  }
  const institution = input.institutionId ? await prisma!.institution.findUnique({ where: { id: input.institutionId }, select: { id: true } }) : undefined;
  if (input.institutionId && !institution) throw new Error("Institution not found");
  const item = await prisma!.media.create({ data: { ...input, verificationStatus: "PENDING" }, include: { institution: { select: { name: true } } } });
  return { id: item.id, institutionId: item.institutionId ?? undefined, institutionName: item.institution?.name, type: item.type, title: item.title, url: item.url, thumbnailUrl: item.thumbnailUrl ?? undefined, languageCode: item.languageCode === "en" || item.languageCode === "bn" ? item.languageCode : undefined, verified: false, updatedAt: item.updatedAt.toISOString() } satisfies MediaRecord;
}

export async function getAdminStats() {
  if (config.demoMode) {
    return { users: demoUsers.length, institutions: demoInstitutions.length, programs: demoPrograms.length, circulars: demoCirculars.length, media: demoMedia.length, pendingVerification: [...demoInstitutions, ...demoPrograms, ...demoCirculars, ...demoMedia].filter((item) => !item.verified).length, comments: demoComments.length, openReports: demoContentReports.filter((item) => item.status === "OPEN" || item.status === "REVIEWING").length, aiInteractions: demoAiInteractions.length };
  }
  const [users, institutions, programs, circulars, media, pendingInstitutions, pendingPrograms, pendingCirculars, pendingMedia, comments, openReports, aiInteractions] = await Promise.all([
    prisma!.user.count(),
    prisma!.institution.count(),
    prisma!.program.count(),
    prisma!.circular.count(),
    prisma!.media.count(),
    prisma!.institution.count({ where: { verificationStatus: { not: "VERIFIED" } } }),
    prisma!.program.count({ where: { verificationStatus: { not: "VERIFIED" } } }),
    prisma!.circular.count({ where: { verificationStatus: { not: "VERIFIED" } } }),
    prisma!.media.count({ where: { verificationStatus: { not: "VERIFIED" } } }),
    prisma!.comment.count(),
    prisma!.contentReport.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma!.aiInteraction.count()
  ]);
  return { users, institutions, programs, circulars, media, pendingVerification: pendingInstitutions + pendingPrograms + pendingCirculars + pendingMedia, comments, openReports, aiInteractions };
}

export async function getCatalogStats() {
  if (config.demoMode) {
    return {
      institutions: demoInstitutions.filter((item) => item.verified).length,
      programs: demoPrograms.filter((item) => item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified)).length,
      circulars: demoCirculars.filter((item) => item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified)).length
    };
  }
  const [institutions, programs, circulars] = await Promise.all([
    prisma!.institution.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma!.program.count({ where: { verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } } }),
    prisma!.circular.count({ where: { verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } } })
  ]);
  return { institutions, programs, circulars };
}

export async function getCatalogCoverage() {
  if (config.demoMode) {
    const districts = bangladeshDivisions.flatMap((division) => division.districts.map((district) => ({ division: division.name, district: district.name, districtCode: district.code, verifiedInstitutions: demoInstitutions.filter((item) => item.verified && item.district.toLowerCase() === district.name.toLowerCase()).length, importedUpazilas: 0, coveredUpazilas: 0 })));
    return { generatedAt: new Date().toISOString(), divisionCount: 8, districtCount: 64, importedUpazilas: 0, districtsWithoutVerifiedInstitutions: districts.filter((item) => item.verifiedInstitutions === 0).length, districts };
  }
  const districts = await prisma!.district.findMany({
    orderBy: [{ division: { name: "asc" } }, { name: "asc" }],
    include: {
      division: { select: { name: true } },
      institutions: { where: { verificationStatus: "VERIFIED" }, select: { id: true } },
      upazilas: { include: { institutions: { where: { verificationStatus: "VERIFIED" }, select: { id: true } } } }
    }
  });
  const rows = districts.map((district) => ({
    division: district.division.name,
    district: district.name,
    districtCode: district.code,
    verifiedInstitutions: district.institutions.length,
    importedUpazilas: district.upazilas.length,
    coveredUpazilas: district.upazilas.filter((upazila) => upazila.institutions.length > 0).length
  }));
  return {
    generatedAt: new Date().toISOString(),
    divisionCount: new Set(rows.map((item) => item.division)).size,
    districtCount: rows.length,
    importedUpazilas: rows.reduce((sum, item) => sum + item.importedUpazilas, 0),
    districtsWithoutVerifiedInstitutions: rows.filter((item) => item.verifiedInstitutions === 0).length,
    districts: rows
  };
}

export async function getCircular(id: string) {
  if (config.demoMode) return demoCirculars.find((item) => item.id === id && item.verified && demoInstitutions.some((institution) => institution.id === item.institutionId && institution.verified)) ?? null;
  const item = await prisma!.circular.findFirst({ where: { id, verificationStatus: "VERIFIED", institution: { verificationStatus: "VERIFIED" } }, include: { institution: { select: { name: true } } } });
  return item ? { id: item.id, institutionId: item.institutionId, institutionName: item.institution.name, title: item.title, academicSession: item.academicSession, applicationStartsAt: item.applicationStartsAt?.toISOString(), applicationEndsAt: item.applicationEndsAt.toISOString(), examAt: item.examAt?.toISOString(), applicationFee: item.applicationFee ?? undefined, sourceUrl: item.sourceUrl, verified: item.verificationStatus === "VERIFIED" } satisfies CircularRecord : null;
}

function demoVerificationStatus(kind: AdminContentKind, id: string, verified: boolean): VerificationStatus {
  return demoVerificationStatuses.get(`${kind}:${id}`) ?? (verified ? "VERIFIED" : kind === "CIRCULAR" ? "PENDING" : "DRAFT");
}

export async function listAdminContent(options: { kind?: AdminContentKind; status?: VerificationStatus } = {}): Promise<AdminContentRecord[]> {
  if (config.demoMode) {
    const records: AdminContentRecord[] = [
      ...demoInstitutions.map((item) => ({ id: item.id, kind: "INSTITUTION" as const, title: item.name, subtitle: `${item.type.replaceAll("_", " ")} · ${item.district}`, status: demoVerificationStatus("INSTITUTION", item.id, item.verified), sourceUrl: item.sourceUrl, editable: { name: item.name, district: item.district, sourceUrl: item.sourceUrl } })),
      ...demoPrograms.map((item) => ({ id: item.id, kind: "PROGRAM" as const, title: item.name, subtitle: `${item.institutionName} · ${item.level}`, status: demoVerificationStatus("PROGRAM", item.id, item.verified), editable: { name: item.name, level: item.level } })),
      ...demoCirculars.map((item) => ({ id: item.id, kind: "CIRCULAR" as const, title: item.title, subtitle: `${item.institutionName} · ${item.academicSession}`, status: demoVerificationStatus("CIRCULAR", item.id, item.verified), sourceUrl: item.sourceUrl, editable: { title: item.title, academicSession: item.academicSession, sourceUrl: item.sourceUrl } })),
      ...demoMedia.map((item) => ({ id: item.id, kind: "MEDIA" as const, title: item.title, subtitle: `${item.institutionName ?? "Global fallback"} · ${item.type}${item.languageCode ? ` · ${item.languageCode.toUpperCase()}` : ""}`, status: demoVerificationStatus("MEDIA", item.id, item.verified), sourceUrl: item.url, updatedAt: item.updatedAt, editable: { title: item.title, type: item.type, url: item.url, sourceUrl: item.url, languageCode: item.languageCode } }))
    ];
    return records.filter((item) => (!options.kind || item.kind === options.kind) && (!options.status || item.status === options.status));
  }

  const statusWhere = options.status ? { verificationStatus: options.status } : {};
  const [institutions, programs, circulars, media] = await Promise.all([
    !options.kind || options.kind === "INSTITUTION" ? prisma!.institution.findMany({ where: statusWhere, orderBy: { updatedAt: "desc" } }) : [],
    !options.kind || options.kind === "PROGRAM" ? prisma!.program.findMany({ where: statusWhere, orderBy: { updatedAt: "desc" }, include: { institution: { select: { name: true } } } }) : [],
    !options.kind || options.kind === "CIRCULAR" ? prisma!.circular.findMany({ where: statusWhere, orderBy: { updatedAt: "desc" }, include: { institution: { select: { name: true } } } }) : [],
    !options.kind || options.kind === "MEDIA" ? prisma!.media.findMany({ where: statusWhere, orderBy: { updatedAt: "desc" }, include: { institution: { select: { name: true } } } }) : []
  ]);
  return [
    ...institutions.map((item) => ({ id: item.id, kind: "INSTITUTION" as const, title: item.name, subtitle: `${item.type.replaceAll("_", " ")} · ${item.district}`, status: item.verificationStatus, sourceUrl: item.sourceUrl ?? undefined, updatedAt: item.updatedAt.toISOString(), editable: { name: item.name, district: item.district, sourceUrl: item.sourceUrl ?? undefined } })),
    ...programs.map((item) => ({ id: item.id, kind: "PROGRAM" as const, title: item.name, subtitle: `${item.institution.name} · ${item.level}`, status: item.verificationStatus, sourceUrl: item.sourceUrl ?? undefined, updatedAt: item.updatedAt.toISOString(), editable: { name: item.name, level: item.level } })),
    ...circulars.map((item) => ({ id: item.id, kind: "CIRCULAR" as const, title: item.title, subtitle: `${item.institution.name} · ${item.academicSession}`, status: item.verificationStatus, sourceUrl: item.sourceUrl, updatedAt: item.updatedAt.toISOString(), editable: { title: item.title, academicSession: item.academicSession, sourceUrl: item.sourceUrl } })),
    ...media.map((item) => ({ id: item.id, kind: "MEDIA" as const, title: item.title, subtitle: `${item.institution?.name ?? "Global fallback"} · ${item.type}${item.languageCode ? ` · ${item.languageCode.toUpperCase()}` : ""}`, status: item.verificationStatus, sourceUrl: item.url, updatedAt: item.updatedAt.toISOString(), editable: { title: item.title, type: item.type, url: item.url, sourceUrl: item.url, languageCode: item.languageCode === "en" || item.languageCode === "bn" ? item.languageCode : undefined } } satisfies AdminContentRecord))
  ];
}

export async function updateContentVerification(kind: AdminContentKind, id: string, status: VerificationStatus, reviewerId: string): Promise<AdminContentRecord> {
  if (config.demoMode) {
    const collection = kind === "INSTITUTION" ? demoInstitutions : kind === "PROGRAM" ? demoPrograms : kind === "CIRCULAR" ? demoCirculars : demoMedia;
    const item = collection.find((entry) => entry.id === id);
    if (!item) throw new Error("Content record not found");
    item.verified = status === "VERIFIED";
    demoVerificationStatuses.set(`${kind}:${id}`, status);
    const updated = (await listAdminContent({ kind, status })).find((entry) => entry.id === id);
    if (!updated) throw new Error("Content record could not be updated");
    return updated;
  }

  const verifiedAt = status === "VERIFIED" ? new Date() : null;
  if (kind === "INSTITUTION") {
    const before = await prisma!.institution.findUnique({ where: { id } });
    if (!before) throw new Error("Content record not found");
    const item = await prisma!.$transaction(async (database) => {
      const updated = await database.institution.update({ where: { id }, data: { verificationStatus: status, verifiedAt } });
      await database.auditLog.create({ data: { adminUserId: reviewerId, action: "UPDATE_VERIFICATION", entityType: kind, entityId: id, before: { verificationStatus: before.verificationStatus }, after: { verificationStatus: status } } });
      return updated;
    });
    return { id: item.id, kind, title: item.name, subtitle: `${item.type.replaceAll("_", " ")} · ${item.district}`, status: item.verificationStatus, sourceUrl: item.sourceUrl ?? undefined, updatedAt: item.updatedAt.toISOString(), editable: { name: item.name, district: item.district, sourceUrl: item.sourceUrl ?? undefined } };
  }
  if (kind === "PROGRAM") {
    const before = await prisma!.program.findUnique({ where: { id } });
    if (!before) throw new Error("Content record not found");
    const item = await prisma!.$transaction(async (database) => {
      const updated = await database.program.update({ where: { id }, data: { verificationStatus: status }, include: { institution: { select: { name: true } } } });
      await database.auditLog.create({ data: { adminUserId: reviewerId, action: "UPDATE_VERIFICATION", entityType: kind, entityId: id, before: { verificationStatus: before.verificationStatus }, after: { verificationStatus: status } } });
      return updated;
    });
    return { id: item.id, kind, title: item.name, subtitle: `${item.institution.name} · ${item.level}`, status: item.verificationStatus, sourceUrl: item.sourceUrl ?? undefined, updatedAt: item.updatedAt.toISOString(), editable: { name: item.name, level: item.level } };
  }
  if (kind === "MEDIA") {
    const before = await prisma!.media.findUnique({ where: { id } });
    if (!before) throw new Error("Content record not found");
    const item = await prisma!.$transaction(async (database) => {
      const updated = await database.media.update({ where: { id }, data: { verificationStatus: status }, include: { institution: { select: { name: true } } } });
      await database.auditLog.create({ data: { adminUserId: reviewerId, action: "UPDATE_VERIFICATION", entityType: kind, entityId: id, before: { verificationStatus: before.verificationStatus }, after: { verificationStatus: status } } });
      return updated;
    });
    return { id: item.id, kind, title: item.title, subtitle: `${item.institution?.name ?? "Global fallback"} · ${item.type}${item.languageCode ? ` · ${item.languageCode.toUpperCase()}` : ""}`, status: item.verificationStatus, sourceUrl: item.url, updatedAt: item.updatedAt.toISOString(), editable: { title: item.title, type: item.type, url: item.url, sourceUrl: item.url, languageCode: item.languageCode === "en" || item.languageCode === "bn" ? item.languageCode : undefined } };
  }
  const before = await prisma!.circular.findUnique({ where: { id } });
  if (!before) throw new Error("Content record not found");
  const item = await prisma!.$transaction(async (database) => {
    const updated = await database.circular.update({ where: { id }, data: { verificationStatus: status }, include: { institution: { select: { name: true } } } });
    await database.auditLog.create({ data: { adminUserId: reviewerId, action: "UPDATE_VERIFICATION", entityType: kind, entityId: id, before: { verificationStatus: before.verificationStatus }, after: { verificationStatus: status } } });
    return updated;
  });
  return { id: item.id, kind, title: item.title, subtitle: `${item.institution.name} · ${item.academicSession}`, status: item.verificationStatus, sourceUrl: item.sourceUrl, updatedAt: item.updatedAt.toISOString(), editable: { title: item.title, academicSession: item.academicSession, sourceUrl: item.sourceUrl } };
}

type AdminContentChanges = { name?: string; district?: string; level?: string; title?: string; academicSession?: string; sourceUrl?: string; type?: MediaType; url?: string; languageCode?: "en" | "bn" | null };

export async function updateAdminContent(kind: AdminContentKind, id: string, input: AdminContentChanges, adminUserId: string): Promise<AdminContentRecord> {
  const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as AdminContentChanges;
  if (config.demoMode) {
    if (kind === "INSTITUTION") {
      const item = demoInstitutions.find((entry) => entry.id === id);
      if (!item) throw new Error("Content record not found");
      if (changes.name) item.name = changes.name;
      if (changes.district) item.district = changes.district;
      if (changes.sourceUrl) item.sourceUrl = changes.sourceUrl;
    } else if (kind === "PROGRAM") {
      const item = demoPrograms.find((entry) => entry.id === id);
      if (!item) throw new Error("Content record not found");
      if (changes.name) item.name = changes.name;
      if (changes.level) item.level = changes.level;
    } else if (kind === "CIRCULAR") {
      const item = demoCirculars.find((entry) => entry.id === id);
      if (!item) throw new Error("Content record not found");
      if (changes.title) item.title = changes.title;
      if (changes.academicSession) item.academicSession = changes.academicSession;
      if (changes.sourceUrl) item.sourceUrl = changes.sourceUrl;
    } else {
      const item = demoMedia.find((entry) => entry.id === id);
      if (!item) throw new Error("Content record not found");
      if (changes.title) item.title = changes.title;
      if (changes.type) item.type = changes.type;
      if (changes.url) item.url = changes.url;
      if (changes.languageCode !== undefined) item.languageCode = changes.languageCode ?? undefined;
      item.updatedAt = new Date().toISOString();
    }
    const updated = (await listAdminContent({ kind })).find((entry) => entry.id === id);
    if (!updated) throw new Error("Content record could not be updated");
    return updated;
  }

  await prisma!.$transaction(async (database) => {
    if (kind === "INSTITUTION") await database.institution.update({ where: { id }, data: { name: changes.name, district: changes.district, sourceUrl: changes.sourceUrl } });
    else if (kind === "PROGRAM") await database.program.update({ where: { id }, data: { name: changes.name, level: changes.level } });
    else if (kind === "CIRCULAR") await database.circular.update({ where: { id }, data: { title: changes.title, academicSession: changes.academicSession, sourceUrl: changes.sourceUrl } });
    else await database.media.update({ where: { id }, data: { title: changes.title, type: changes.type, url: changes.url, languageCode: changes.languageCode } });
    await database.auditLog.create({ data: { adminUserId, action: "EDIT_CONTENT", entityType: kind, entityId: id, after: changes as Prisma.InputJsonObject } });
  });
  const updated = (await listAdminContent({ kind })).find((entry) => entry.id === id);
  if (!updated) throw new Error("Content record could not be updated");
  return updated;
}

export async function recordAiInteraction(input: Omit<AiInteractionRecord, "id" | "createdAt"> & { safetyNotice?: string }) {
  if (config.demoMode) {
    const item: AiInteractionRecord = { id: `ai_${Date.now()}`, userId: input.userId, feature: input.feature, prompt: input.prompt, response: input.response, model: input.model, sourceIds: input.sourceIds, createdAt: new Date().toISOString() };
    demoAiInteractions.unshift(item);
    return item;
  }
  const item = await prisma!.aiInteraction.create({ data: input });
  return { id: item.id, userId: item.userId, feature: item.feature, prompt: item.prompt, response: item.response, model: item.model, sourceIds: item.sourceIds, createdAt: item.createdAt.toISOString() } satisfies AiInteractionRecord;
}

export async function createContentReport(reporterId: string, targetId: string, reason: string, details?: string) {
  if (config.demoMode) {
    if (!demoComments.some((item) => item.id === targetId)) throw new Error("Comment not found");
    const reporter = demoUsers.find((item) => item.id === reporterId);
    if (!reporter) throw new Error("Reporter not found");
    const existing = demoContentReports.find((item) => item.reporterId === reporterId && item.targetType === "COMMENT" && item.targetId === targetId);
    if (existing) return existing;
    const report: ContentReportRecord = { id: `report_${Date.now()}`, reporterId, reporterUsername: reporter.username, targetType: "COMMENT", targetId, reason, details, status: "OPEN", createdAt: new Date().toISOString() };
    demoContentReports.unshift(report);
    return report;
  }
  const comment = await prisma!.comment.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!comment) throw new Error("Comment not found");
  const item = await prisma!.contentReport.upsert({
    where: { reporterId_targetType_targetId: { reporterId, targetType: "COMMENT", targetId } },
    create: { reporterId, targetType: "COMMENT", targetId, reason, details },
    update: { reason, details, status: "OPEN", resolution: null, reviewedAt: null, reviewedBy: null },
    include: { reporter: { select: { username: true } } }
  });
  return { id: item.id, reporterId: item.reporterId, reporterUsername: item.reporter.username, targetType: item.targetType, targetId: item.targetId, reason: item.reason, details: item.details ?? undefined, status: item.status, resolution: item.resolution ?? undefined, createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() } satisfies ContentReportRecord;
}

export async function listContentReports(status?: ReportStatus) {
  if (config.demoMode) return demoContentReports.filter((item) => !status || item.status === status);
  const items = await prisma!.contentReport.findMany({ where: status ? { status } : undefined, orderBy: { createdAt: "desc" }, include: { reporter: { select: { username: true } } } });
  return items.map((item) => ({ id: item.id, reporterId: item.reporterId, reporterUsername: item.reporter.username, targetType: item.targetType, targetId: item.targetId, reason: item.reason, details: item.details ?? undefined, status: item.status, resolution: item.resolution ?? undefined, createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() } satisfies ContentReportRecord));
}

export async function updateContentReportStatus(reportId: string, reviewerId: string, status: ReportStatus, resolution?: string) {
  if (config.demoMode) {
    const report = demoContentReports.find((item) => item.id === reportId);
    if (!report) throw new Error("Report not found");
    report.status = status;
    report.resolution = resolution;
    report.reviewedAt = new Date().toISOString();
    return report;
  }
  const item = await prisma!.contentReport.update({ where: { id: reportId }, data: { status, resolution, reviewedBy: reviewerId, reviewedAt: new Date() }, include: { reporter: { select: { username: true } } } });
  return { id: item.id, reporterId: item.reporterId, reporterUsername: item.reporter.username, targetType: item.targetType, targetId: item.targetId, reason: item.reason, details: item.details ?? undefined, status: item.status, resolution: item.resolution ?? undefined, createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() } satisfies ContentReportRecord;
}

export async function getAdminAnalytics() {
  if (config.demoMode) {
    const applications = [...demoApplications.values()].flat();
    const applicationStatuses = Object.entries(applications.reduce<Record<string, number>>((result, item) => ({ ...result, [item.status]: (result[item.status] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value }));
    const reportStatuses = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].map((label) => ({ label, value: demoContentReports.filter((item) => item.status === label).length }));
    const topRatedInstitutions = [...demoRatings.entries()].map(([institutionId, ratings]) => ({ label: demoInstitutions.find((item) => item.id === institutionId)?.name ?? institutionId, value: Number(([...ratings.values()].reduce((sum, score) => sum + score, 0) / Math.max(1, ratings.size)).toFixed(1)), count: ratings.size })).sort((a, b) => b.value - a.value).slice(0, 5);
    return { overview: await getAdminStats(), applicationStatuses, reportStatuses, topRatedInstitutions, activity: { applications: applications.length, comments: demoComments.length, ratings: [...demoRatings.values()].reduce((sum, item) => sum + item.size, 0), aiInteractions: demoAiInteractions.length } };
  }
  const [applicationGroups, reportGroups, ratingGroups, comments, ratings, aiInteractions, applications] = await Promise.all([
    prisma!.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma!.contentReport.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma!.rating.groupBy({ by: ["institutionId"], where: { institutionId: { not: null } }, _avg: { score: true }, _count: { _all: true }, orderBy: { _avg: { score: "desc" } }, take: 5 }),
    prisma!.comment.count(), prisma!.rating.count(), prisma!.aiInteraction.count(), prisma!.application.count()
  ]);
  const names = await prisma!.institution.findMany({ where: { id: { in: ratingGroups.flatMap((item) => item.institutionId ? [item.institutionId] : []) } }, select: { id: true, name: true } });
  const nameMap = new Map(names.map((item) => [item.id, item.name]));
  return {
    overview: await getAdminStats(),
    applicationStatuses: applicationGroups.map((item) => ({ label: item.status, value: item._count._all })),
    reportStatuses: reportGroups.map((item) => ({ label: item.status, value: item._count._all })),
    topRatedInstitutions: ratingGroups.map((item) => ({ label: nameMap.get(item.institutionId!) ?? item.institutionId!, value: Number((item._avg.score ?? 0).toFixed(1)), count: item._count._all })),
    activity: { applications, comments, ratings, aiInteractions }
  };
}

export async function disconnectStore() {
  await prisma?.$disconnect();
}
