import { PrismaClient } from "@prisma/client";
import { demoCirculars, demoInstitutions, demoPrograms, demoScholarships } from "../src/data/demo-catalog.js";

const prisma = new PrismaClient();

async function main() {
  for (const institution of demoInstitutions) {
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
        verificationStatus: institution.verified ? "VERIFIED" : "DRAFT"
      }
    });
  }

  for (const program of demoPrograms) {
    await prisma.program.upsert({
      where: { id: program.id },
      create: {
        id: program.id,
        institutionId: program.institutionId,
        name: program.name,
        slug: program.slug,
        level: program.level,
        durationMonths: program.durationMonths,
        tuitionMin: program.tuitionMin,
        tuitionMax: program.tuitionMax,
        careerOutcomes: program.careerOutcomes,
        verificationStatus: program.verified ? "VERIFIED" : "DRAFT"
      },
      update: {
        name: program.name,
        level: program.level,
        durationMonths: program.durationMonths,
        tuitionMin: program.tuitionMin,
        tuitionMax: program.tuitionMax,
        careerOutcomes: program.careerOutcomes,
        verificationStatus: program.verified ? "VERIFIED" : "DRAFT"
      }
    });
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
        sourceUrl: demoInstitutions.find((item) => item.id === program.institutionId)?.sourceUrl ?? "https://moedu.gov.bd"
      },
      update: {
        applicantStage: program.level === "Diploma" ? "SSC" : "HSC",
        allowedGroups: program.groups,
        minimumSscGpa: program.level === "Diploma" || program.level === "Certificate" ? program.minimumGpa || undefined : null,
        minimumHscGpa: program.level === "Diploma" || program.level === "Certificate" ? null : program.minimumGpa || undefined
      }
    });
  }

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

  console.log(`Seeded ${demoInstitutions.length} institutions, ${demoPrograms.length} programs, ${demoCirculars.length} circulars, ${demoScholarships.length} scholarships and community starter content.`);
}

main().finally(() => prisma.$disconnect());
