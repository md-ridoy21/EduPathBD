import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";

const failures: string[] = [];
const passed: string[] = [];
const pass = (message: string) => { passed.push(message); console.log(`PASS: ${message}`); };
const fail = (message: string) => { failures.push(message); console.error(`FAIL: ${message}`); };

if (process.env.NODE_ENV !== "production" || String(process.env.DEMO_MODE).toLowerCase() !== "false") throw new Error("Integration verification requires NODE_ENV=production and DEMO_MODE=false.");

const prisma = new PrismaClient();
try {
  try { await prisma.$queryRaw`SELECT 1`; pass("PostgreSQL accepts authenticated queries"); }
  catch (error) { fail(`PostgreSQL probe failed: ${error instanceof Error ? error.message : String(error)}`); }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    if (!projectId) throw new Error("FIREBASE_PROJECT_ID is missing");
    const app = getApps()[0] ?? initializeApp({ projectId, credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault() });
    await getAuth(app).listUsers(1);
    pass("Firebase Admin credentials can access the configured project");
  } catch (error) { fail(`Firebase Admin probe failed: ${error instanceof Error ? error.message : String(error)}`); }

  try {
    const url = process.env.SUPABASE_URL?.trim();
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "edupath-media";
    if (!url || !serviceRole) throw new Error("Supabase URL or service-role key is missing");
    const result = await createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } }).storage.getBucket(bucket);
    if (result.error) throw result.error;
    if (!result.data?.name) throw new Error("Storage bucket response was empty");
    pass(`Supabase Storage bucket '${bucket}' is reachable`);
  } catch (error) { fail(`Supabase Storage probe failed: ${error instanceof Error ? error.message : String(error)}`); }
} finally { await prisma.$disconnect(); }

console.log(`\nIntegration verification: ${passed.length} passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
console.log("EduPath BD critical server integrations are reachable. No secret values were printed.");
