import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  const [
    admissionCount,
    scholarshipCount,
    admissionByStatus,
    scholarshipByStatus,
    admissionSample,
    scholarshipSample,
  ] = await Promise.all([
    prisma.admissionRule.count(),
    prisma.scholarship.count(),
    prisma.admissionRule.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
    prisma.scholarship.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
    prisma.admissionRule.findMany({ take: 20, orderBy: { createdAt: "asc" } }),
    prisma.scholarship.findMany({ take: 20, orderBy: { createdAt: "asc" } }),
  ]);

  console.log(JSON.stringify({
    mode: "READ_ONLY_EXISTING_DB_SNAPSHOT",
    dbWritesPerformed: false,
    admissionRuleCount: admissionCount,
    scholarshipCount,
    admissionByStatus,
    scholarshipByStatus,
    admissionSample,
    scholarshipSample,
  }, null, 2));

  await prisma.$disconnect();
})().catch(async e => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
