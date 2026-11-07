import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const apiPackage = JSON.parse(await readFile("apps/api/package.json", "utf8"));
const rootPackage = JSON.parse(await readFile("package.json", "utf8"));
const dockerfile = await readFile("apps/api/Dockerfile", "utf8");
const authFirebase = await readFile("apps/api/src/auth/firebase.ts", "utf8");

test("persistent API runtime excludes Prisma CLI and optional dependency trees", () => {
  assert.equal(apiPackage.dependencies?.prisma, undefined);
  assert.ok(apiPackage.devDependencies?.prisma);
  assert.match(dockerfile, /npm prune --omit=dev --omit=optional/);
});

test("runtime high-severity audit matches the shipped dependency surface", () => {
  assert.match(rootPackage.scripts["audit:runtime:high"], /--omit=dev --omit=optional --audit-level=high/);
  assert.match(rootPackage.scripts["release:gate"], /audit:runtime:high/);
  assert.match(rootPackage.scripts["release:gate"], /audit:tooling:critical/);
});

test("Firebase Admin optional Firestore and Storage modules are not application dependencies", () => {
  assert.match(authFirebase, /firebase-admin\/app/);
  assert.match(authFirebase, /firebase-admin\/auth/);
  assert.doesNotMatch(authFirebase, /firebase-admin\/(firestore|storage)/);
});
