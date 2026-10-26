import process from "node:process";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient();
const checks = [];

async function count(name, severity, sql, message) {
  const rows = await prisma.$queryRawUnsafe(sql);
  const value = Number(rows[0]?.count ?? 0);
  checks.push({ name, severity, passed: value === 0, count: value, message });
}

try {
  await prisma.$queryRaw`SELECT 1`;
  const tableCounts = Object.fromEntries(await Promise.all([
    ["users", prisma.user.count()],
    ["institutions", prisma.institution.count()],
    ["programs", prisma.program.count()],
    ["circulars", prisma.circular.count()],
    ["scholarships", prisma.scholarship.count()],
    ["applications", prisma.application.count()],
    ["comments", prisma.comment.count()],
    ["media", prisma.media.count()]
  ].map(async ([name, promise]) => [name, await promise])));

  await count("rating-score-range", "error", 'SELECT COUNT(*)::int AS count FROM "Rating" WHERE "score" < 1 OR "score" > 5', "Ratings must stay between 1 and 5.");
  await count("application-date-order", "error", 'SELECT COUNT(*)::int AS count FROM "Circular" WHERE "applicationStartsAt" IS NOT NULL AND "applicationEndsAt" < "applicationStartsAt"', "Circular closing dates cannot precede opening dates.");
  await count("tuition-range-order", "error", 'SELECT COUNT(*)::int AS count FROM "Program" WHERE "tuitionMin" IS NOT NULL AND "tuitionMax" IS NOT NULL AND "tuitionMax" < "tuitionMin"', "Maximum tuition cannot be lower than minimum tuition.");
  await count("duplicate-casefolded-usernames", "error", 'SELECT COUNT(*)::int AS count FROM (SELECT LOWER("username") FROM "User" GROUP BY LOWER("username") HAVING COUNT(*) > 1) duplicates', "Usernames must remain unique without regard to case.");
  await count("duplicate-casefolded-emails", "error", 'SELECT COUNT(*)::int AS count FROM (SELECT LOWER("email") FROM "User" GROUP BY LOWER("email") HAVING COUNT(*) > 1) duplicates', "Emails must remain unique without regard to case.");
  await count("verified-institution-source", "error", 'SELECT COUNT(*)::int AS count FROM "Institution" WHERE "verificationStatus" = \'VERIFIED\' AND ("sourceUrl" IS NULL OR BTRIM("sourceUrl") = \'\')', "Verified institutions require an official source URL.");
  await count("verified-program-source", "error", 'SELECT COUNT(*)::int AS count FROM "Program" WHERE "verificationStatus" = \'VERIFIED\' AND ("sourceUrl" IS NULL OR BTRIM("sourceUrl") = \'\')', "Verified programs require an official source URL.");
  await count("insecure-media-url", "error", 'SELECT COUNT(*)::int AS count FROM "Media" WHERE "verificationStatus" = \'VERIFIED\' AND "url" !~ \'^https://\'', "Verified media must use HTTPS.");
  await count("stale-pending-content", "warning", 'SELECT COUNT(*)::int AS count FROM (SELECT "updatedAt" FROM "Institution" WHERE "verificationStatus" = \'PENDING\' UNION ALL SELECT "updatedAt" FROM "Program" WHERE "verificationStatus" = \'PENDING\' UNION ALL SELECT "updatedAt" FROM "Circular" WHERE "verificationStatus" = \'PENDING\' UNION ALL SELECT "updatedAt" FROM "Media" WHERE "verificationStatus" = \'PENDING\') pending WHERE "updatedAt" < NOW() - INTERVAL \'30 days\'', "Pending content older than 30 days should be reviewed.");

  const errors = checks.filter((item) => item.severity === "error" && !item.passed);
  const warnings = checks.filter((item) => item.severity === "warning" && !item.passed);
  console.log(JSON.stringify({ event: "database_integrity_report", checkedAt: new Date().toISOString(), tableCounts, status: errors.length ? "failed" : warnings.length ? "warning" : "healthy", checks, summary: { passed: checks.filter((item) => item.passed).length, warnings: warnings.length, errors: errors.length } }, null, 2));
  if (errors.length) process.exitCode = 1;
  if (warnings.length && process.argv.includes("--strict")) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
