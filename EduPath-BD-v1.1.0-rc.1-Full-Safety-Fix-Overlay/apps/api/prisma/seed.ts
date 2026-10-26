import { PrismaClient } from "@prisma/client";
import { demoCirculars, demoInstitutions, demoPrograms, demoScholarships } from "../src/data/demo-catalog.js";
import { bangladeshDivisions } from "../src/data/bangladesh-locations.js";
import { officialSources } from "../src/data/official-sources.js";

const prisma = new PrismaClient();
const includeDemoContent = process.argv.includes("--include-demo-content");
const repairLegacyDemoData = process.argv.includes("--repair-legacy-demo-data");

if (includeDemoContent && repairLegacyDemoData) {
  throw new Error("Choose either --include-demo-content or --repair-legacy-demo-data, not both.");
}

async function main() {
  for (const source of officialSources) {
    await prisma.dataSource.upsert({
      where: { id: source.id },
      create: { id: source.id, authority: source.authority, name: source.name, baseUrl: source.baseUrl, datasetUrl: source.datasetUrl },
      update: { authority: source.authority, name: source.name, baseUrl: source.baseUrl, datasetUrl: source.datasetUrl }
    });
  }

  for (const division of bangladeshDivisions) {
    const divisionId = `division_${division.slug}`;
    await prisma.division.upsert({
      where: { id: divisionId },
      create: { id: divisionId, code: division.code, slug: division.slug, name: division.name, nameBn: division.nameBn },
      update: { code: division.code, slug: division.slug, name: division.name, nameBn: division.nameBn }
    });
    for (const district of division.districts) {
      await prisma.district.upsert({
        where: { id: `district_${district.slug}` },
        create: { id: `district_${district.slug}`, divisionId, code: district.code, slug: district.slug, name: district.name, nameBn: district.nameBn },
        update: { divisionId, code: district.code, slug: district.slug, name: district.name, nameBn: district.nameBn }
      });
    }
  }

  const districtLookup = new Map(bangladeshDivisions.flatMap((division) => division.districts.map((district) => [district.name.toLowerCase(), { districtId: `district_${district.slug}`, divisionId: `division_${division.slug}` }] as const)));
  const sourceForInstitutionType = (type: string) => type === "POLYTECHNIC" || type === "TECHNICAL" || type === "TRAINING_PROVIDER"
    ? "source_bteb"
    : type === "MEDICAL"
      ? "source_dgme"
      : type === "NATIONAL_UNIVERSITY_COLLEGE"
        ? "source_nu"
        : type === "PUBLIC_UNIVERSITY" || type === "PRIVATE_UNIVERSITY" || type === "ENGINEERING"
          ? "source_ugc"
          : "source_banbeis";

  for (const institution of demoInstitutions) {
    const location = districtLookup.get(institution.district.toLowerCase());
    await prisma.institution.upsert({
      where: { id: institution.id },
      create: {
        id: institution.id,
        name: institution.name,
        slug: institution.slug,
        type: institution.type,
        district: institution.district,
        description: institution.description,
        websiteUrl: institution.websiteUrl,
        sourceUrl: institution.sourceUrl,
        dataSourceId: sourceForInstitutionType(institution.type),
        districtId: location?.districtId,
        divisionId: location?.divisionId,
        verificationStatus: institution.verified ? "VERIFIED" : "DRAFT",
        verifiedAt: institution.verified ? new Date() : undefined
      },
      update: {
        name: institution.name,
        type: institution.type,
        district: institution.district,
        description: institution.description,
        websiteUrl: institution.websiteUrl,
        sourceUrl: institution.sourceUrl,
        dataSourceId: sourceForInstitutionType(institution.type),
        districtId: location?.districtId,
        divisionId: location?.divisionId,
        verificationStatus: institution.verified ? "VERIFIED" : "DRAFT"
      }
    });
  }

  for (const program of demoPrograms) {
    const parentInstitution = demoInstitutions.find((item) => item.id === program.institutionId);
    const institutionSourceUrl = parentInstitution?.sourceUrl ?? "https://moedu.gov.bd";
    const searchable = `${program.name} ${parentInstitution?.name ?? ""}`.toLowerCase();
    const pathwayCategory = program.level === "Diploma"
      ? "POLYTECHNIC_DIPLOMA"
      : /medical|mbbs|dental/.test(searchable)
        ? "MEDICAL_DENTAL"
        : /engineering|technology|computer|software|cse|eee|civil/.test(searchable)
          ? "ENGINEERING"
          : "UNIVERSITY_GENERAL";
    const entryStage = program.level === "Diploma" || program.level === "Certificate" ? "SSC" : "HSC";
    const dataSourceId = sourceForInstitutionType(parentInstitution?.type ?? "COLLEGE");
    await prisma.program.upsert({
      where: { id: program.id },
      create: {
        id: program.id,
        institutionId: program.institutionId,
        name: program.name,
        slug: program.slug,
        level: program.level,
        pathwayCategory,
        entryStage,
        availableGroups: program.groups,
        dataSourceId,
        durationMonths: program.durationMonths,
        tuitionMin: includeDemoContent ? program.tuitionMin : undefined,
        tuitionMax: includeDemoContent ? program.tuitionMax : undefined,
        careerOutcomes: program.careerOutcomes,
        verificationStatus: program.verified ? "VERIFIED" : "DRAFT",
        sourceUrl: institutionSourceUrl
      },
      update: {
        name: program.name,
        level: program.level,
        pathwayCategory,
        entryStage,
        availableGroups: program.groups,
        dataSourceId,
        durationMonths: program.durationMonths,
        ...(includeDemoContent
          ? { tuitionMin: program.tuitionMin, tuitionMax: program.tuitionMax }
          : repairLegacyDemoData
            ? { tuitionMin: null, tuitionMax: null }
            : {}),
        careerOutcomes: program.careerOutcomes,
        verificationStatus: program.verified ? "VERIFIED" : "DRAFT",
        sourceUrl: institutionSourceUrl
      }
    });
    if (includeDemoContent) {
      await prisma.admissionRule.upsert({
        where: { programId_academicSession: { programId: program.id, academicSession: "2026-27" } },
        create: {
          programId: program.id,
          academicSession: "2026-27",
          applicantStage: program.level === "Diploma" ? "SSC" : "HSC",
          allowedGroups: program.groups,
          ...(program.level === "Diploma" || program.level === "Certificate"
            ? { minimumSscGpa: program.minimumGpa || undefined }
            : { minimumHscGpa: program.minimumGpa || undefined }),
          sourceUrl: institutionSourceUrl,
          verificationStatus: program.verified ? "VERIFIED" : "PENDING",
          verifiedAt: program.verified ? new Date() : undefined
        },
        update: {
          applicantStage: program.level === "Diploma" ? "SSC" : "HSC",
          allowedGroups: program.groups,
          minimumSscGpa: program.level === "Diploma" || program.level === "Certificate" ? program.minimumGpa || undefined : null,
          minimumHscGpa: program.level === "Diploma" || program.level === "Certificate" ? null : program.minimumGpa || undefined,
          sourceUrl: institutionSourceUrl,
          verificationStatus: program.verified ? "VERIFIED" : "PENDING",
          verifiedAt: program.verified ? new Date() : null
        }
      });
    }
  }

  if (includeDemoContent) {
    for (const circular of demoCirculars) {
      await prisma.circular.upsert({
        where: { id: circular.id },
        create: {
          id: circular.id,
          institutionId: circular.institutionId,
          title: circular.title,
          academicSession: circular.academicSession,
          applicationStartsAt: circular.applicationStartsAt ? new Date(circular.applicationStartsAt) : undefined,
          applicationEndsAt: new Date(circular.applicationEndsAt),
          examAt: circular.examAt ? new Date(circular.examAt) : undefined,
          applicationFee: circular.applicationFee,
          sourceUrl: circular.sourceUrl,
          verificationStatus: circular.verified ? "VERIFIED" : "PENDING"
        },
        update: {
          title: circular.title,
          applicationStartsAt: circular.applicationStartsAt ? new Date(circular.applicationStartsAt) : undefined,
          applicationEndsAt: new Date(circular.applicationEndsAt),
          examAt: circular.examAt ? new Date(circular.examAt) : undefined,
          applicationFee: circular.applicationFee,
          sourceUrl: circular.sourceUrl,
          verificationStatus: circular.verified ? "VERIFIED" : "PENDING"
        }
      });
    }

    for (const scholarship of demoScholarships) {
      await prisma.scholarship.upsert({
        where: { id: scholarship.id },
        create: {
          id: scholarship.id,
          title: scholarship.title,
          provider: scholarship.provider,
          description: scholarship.description,
          institutionId: demoInstitutions.find((item) => item.name === scholarship.institutionName)?.id,
          eligibility: { minimumGpa: scholarship.minimumGpa, groups: scholarship.groups, levels: scholarship.levels },
          amountDescription: scholarship.amountDescription,
          deadline: scholarship.deadline ? new Date(scholarship.deadline) : undefined,
          sourceUrl: scholarship.sourceUrl,
          verificationStatus: scholarship.verified ? "VERIFIED" : "PENDING"
        },
        update: {
          title: scholarship.title,
          provider: scholarship.provider,
          description: scholarship.description,
          eligibility: { minimumGpa: scholarship.minimumGpa, groups: scholarship.groups, levels: scholarship.levels },
          amountDescription: scholarship.amountDescription,
          deadline: scholarship.deadline ? new Date(scholarship.deadline) : null,
          sourceUrl: scholarship.sourceUrl,
          verificationStatus: scholarship.verified ? "VERIFIED" : "PENDING"
        }
      });
    }
  }

  if (includeDemoContent) {
    const guide = await prisma.user.upsert({
      where: { id: "seed_community_guide" },
      create: { id: "seed_community_guide", username: "edupath_guide", email: "guide@seed.edupath.local", displayName: "EduPath Verified Guide", role: "MODERATOR", emailVerifiedAt: new Date() },
      update: { displayName: "EduPath Verified Guide", role: "MODERATOR" }
    });
    const student = await prisma.user.upsert({
      where: { id: "seed_demo_student" },
      create: { id: "seed_demo_student", username: "seed_student", email: "student@seed.edupath.local", displayName: "Demo Student", role: "STUDENT", emailVerifiedAt: new Date() },
      update: { displayName: "Demo Student", role: "STUDENT" }
    });
    const discussion = await prisma.discussionPost.upsert({
      where: { id: "post_du_admission" },
      create: { id: "post_du_admission", authorId: guide.id, institutionId: "inst_du", title: "University of Dhaka admission discussion", body: "Ask questions and share source-based admission guidance." },
      update: { title: "University of Dhaka admission discussion" }
    });
    await prisma.comment.upsert({
      where: { id: "comment_demo_1" },
      create: { id: "comment_demo_1", postId: discussion.id, authorId: guide.id, body: "Always match your GPA and subject requirements with the latest official circular.", isVerified: true },
      update: { body: "Always match your GPA and subject requirements with the latest official circular.", isVerified: true }
    });
    const studentComment = await prisma.comment.upsert({
      where: { id: "comment_demo_2" },
      create: { id: "comment_demo_2", postId: discussion.id, authorId: student.id, body: "The source link beside each deadline makes this much easier to verify." },
      update: { body: "The source link beside each deadline makes this much easier to verify." }
    });
    await prisma.contentReport.upsert({
      where: { id: "report_demo_1" },
      create: { id: "report_demo_1", reporterId: guide.id, targetType: "COMMENT", targetId: studentComment.id, reason: "VERIFY_SOURCE", details: "Please confirm that the linked deadline still matches the latest circular." },
      update: { reason: "VERIFY_SOURCE", status: "OPEN" }
    });
    await prisma.rating.upsert({
      where: { id: "rating_seed_du" },
      create: { id: "rating_seed_du", userId: guide.id, institutionId: "inst_du", score: 5, review: "Sample verified-guide rating for the classroom dataset." },
      update: { score: 5 }
    });
  }

  let removedCirculars = 0;
  let removedScholarships = 0;
  let removedAdmissionRules = 0;
  if (repairLegacyDemoData) {
    const circularIds = demoCirculars.map((item) => item.id);
    const scholarshipIds = demoScholarships.map((item) => item.id);
    const programIds = demoPrograms.map((item) => item.id);
    await prisma.savedItem.deleteMany({ where: { itemId: { in: [...circularIds, ...scholarshipIds] } } });
    const [circularCleanup, scholarshipCleanup, admissionRuleCleanup] = await prisma.$transaction([
      prisma.circular.deleteMany({ where: { id: { in: circularIds } } }),
      prisma.scholarship.deleteMany({ where: { id: { in: scholarshipIds } } }),
      prisma.admissionRule.deleteMany({ where: { programId: { in: programIds }, academicSession: "2026-27" } })
    ]);
    removedCirculars = circularCleanup.count;
    removedScholarships = scholarshipCleanup.count;
    removedAdmissionRules = admissionRuleCleanup.count;
  }

  console.log(`Seeded 8 divisions, 64 districts, ${officialSources.length} official source registries, ${demoInstitutions.length} institutions and ${demoPrograms.length} programs.`);
  if (includeDemoContent) {
    console.log(`Included ${demoCirculars.length} demo circulars, ${demoScholarships.length} demo scholarships and explicitly requested demo community fixtures.`);
  } else if (repairLegacyDemoData) {
    console.log(`Production repair: removed ${removedAdmissionRules} legacy demo admission rules, ${removedCirculars} legacy demo circulars and ${removedScholarships} legacy demo scholarships.`);
  } else {
    console.log("Production-safe default: skipped demo admission rules, tuition ranges, circulars, scholarships, users and community fixtures. Existing records were not deleted; run db:seed:repair explicitly after a verified backup to remove legacy demo data.");
  }
}

main().finally(() => prisma.$disconnect());
