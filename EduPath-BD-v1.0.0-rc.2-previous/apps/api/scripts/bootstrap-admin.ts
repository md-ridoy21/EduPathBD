import "dotenv/config";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const argValue = (name: string) => {
  const pair = args.find((item) => item.startsWith(`${name}=`));
  if (pair) return pair.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const email = (argValue("--email") ?? "").trim().toLowerCase();
const requestedUsername = (argValue("--username") ?? "").trim().toLowerCase();
if (!args.includes("--confirm-promote-admin")) throw new Error("Refusing to change roles without --confirm-promote-admin.");
if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Provide the verified Firebase email with --email admin@example.com.");
if (process.env.NODE_ENV !== "production" || String(process.env.DEMO_MODE).toLowerCase() !== "false") throw new Error("Admin bootstrap is restricted to NODE_ENV=production and DEMO_MODE=false.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!process.env.FIREBASE_PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID is required.");

function firebaseApp() {
  if (getApps().length) return getApps()[0]!;
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    : applicationDefault();
  return initializeApp({ credential, projectId: process.env.FIREBASE_PROJECT_ID });
}

const prisma = new PrismaClient();
try {
  const firebaseUser = await getAuth(firebaseApp()).getUserByEmail(email);
  if (!firebaseUser.emailVerified) throw new Error("The Firebase account email must be verified before it can become an EduPath admin.");
  const existing = await prisma.user.findFirst({ where: { OR: [{ firebaseUid: firebaseUser.uid }, { email }] } });
  if (existing?.firebaseUid && existing.firebaseUid !== firebaseUser.uid) throw new Error("The existing EduPath user is linked to a different Firebase UID.");
  if (!existing && !/^[a-z][a-z0-9_]{3,19}$/.test(requestedUsername)) throw new Error("For a new user, provide a valid --username.");
  const username = existing?.username ?? requestedUsername;
  const displayName = firebaseUser.displayName?.trim() || email.split("@")[0] || "EduPath Admin";
  const user = await prisma.$transaction(async (transaction) => {
    const saved = existing
      ? await transaction.user.update({ where: { id: existing.id }, data: { firebaseUid: firebaseUser.uid, email, displayName, role: "ADMIN", emailVerifiedAt: new Date() } })
      : await transaction.user.create({ data: { firebaseUid: firebaseUser.uid, username, email, displayName, role: "ADMIN", emailVerifiedAt: new Date() } });
    await transaction.auditLog.create({ data: { adminUserId: saved.id, action: existing?.role === "ADMIN" ? "ADMIN_BOOTSTRAP_RECONFIRMED" : "ADMIN_BOOTSTRAP_PROMOTION", entityType: "User", entityId: saved.id, before: existing ? { role: existing.role } : undefined, after: { role: "ADMIN", firebaseUidLinked: true } } });
    return saved;
  });
  console.log(`EduPath admin bootstrap complete for ${user.username} (${email}).`);
  console.log("No Firebase token, service-account secret or database password was printed.");
} finally {
  await prisma.$disconnect();
}
