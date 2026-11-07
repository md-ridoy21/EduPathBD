import { readFile } from "node:fs/promises";

let failures = 0;
const ok = (condition, message) => {
  if (condition) console.log(`✓ ${message}`);
  else { failures += 1; console.error(`✗ ${message}`); }
};

const apiPackage = JSON.parse(await readFile("apps/api/package.json", "utf8"));
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const dockerfile = await readFile("apps/api/Dockerfile", "utf8");
const firebaseSource = await readFile("apps/api/src/auth/firebase.ts", "utf8");
const bootstrapSource = await readFile("apps/api/scripts/bootstrap-admin.ts", "utf8");
const integrationSource = await readFile("apps/api/scripts/verify-integrations.ts", "utf8");
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const packages = lock.packages ?? {};

ok(!apiPackage.dependencies?.prisma && Boolean(apiPackage.devDependencies?.prisma), "Prisma CLI is tooling-only, not an API runtime dependency");
ok(Boolean(apiPackage.dependencies?.["@prisma/client"]), "Prisma Client remains an explicit API runtime dependency");
ok(dockerfile.includes("npm prune --omit=dev --omit=optional"), "runtime image prunes development and optional dependency trees");
ok(rootPackage.scripts?.["audit:runtime:high"]?.includes("better-npm-audit audit --production --level high"), "release audit targets the shipped runtime dependency surface at high severity");
ok(rootPackage.scripts?.["audit:tooling:critical"]?.includes("better-npm-audit audit --level critical"), "tooling dependency tree still has a critical-severity fail gate");
ok(rootPackage.scripts?.["release:gate"]?.includes("audit:runtime:high") && rootPackage.scripts?.["release:gate"]?.includes("audit:tooling:critical"), "release gate checks runtime high severity and full-tooling critical severity");

const firebaseCombined = [firebaseSource, bootstrapSource, integrationSource].join("\n");
ok(firebaseCombined.includes('firebase-admin/app') && firebaseCombined.includes('firebase-admin/auth'), "Firebase Admin is used for application/authentication services");
ok(!/firebase-admin\/(firestore|storage)/.test(firebaseCombined) && !/getFirestore\s*\(|getStorage\s*\(/.test(firebaseCombined), "API does not depend on optional Firebase Admin Firestore or Storage SDKs");

const prismaLock = packages["node_modules/prisma"];
const prismaConfigLock = packages["node_modules/@prisma/config"];
const deepmergeLock = packages["node_modules/deepmerge-ts"];
ok(Boolean(prismaLock?.devOptional || prismaLock?.dev), "locked Prisma CLI is marked development/optional by npm");
ok(Boolean(prismaConfigLock?.devOptional || prismaConfigLock?.dev), "locked @prisma/config is outside the persistent runtime surface");
ok(Boolean(deepmergeLock?.devOptional || deepmergeLock?.dev), "locked deepmerge-ts finding belongs to the Prisma tooling tree, not the persistent API runtime");

if (failures) {
  console.error(`Security dependency-scope verification failed: ${failures} check(s).`);
  process.exit(1);
}
console.log("EduPath BD runtime dependency scope is explicit and verified.");
