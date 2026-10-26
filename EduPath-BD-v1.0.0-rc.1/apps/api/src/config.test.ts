import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.js";

const validProduction = {
  NODE_ENV: "production",
  DEMO_MODE: "false",
  DATABASE_URL: "postgresql://edupath:secret@postgres:5432/edupath",
  JWT_SECRET: "p9S3_very-long-random-production-secret_7zQ2",
  WEB_ORIGINS: "https://app.edupath.example,capacitor://localhost,https://localhost",
  FIREBASE_PROJECT_ID: "edupath-production",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-value"
};

test("production configuration requires non-demo mode", () => {
  assert.throws(() => loadConfig({ ...validProduction, DEMO_MODE: "true" }), /DEMO_MODE must be false/);
});

test("production configuration rejects documented secrets", () => {
  assert.throws(() => loadConfig({ ...validProduction, JWT_SECRET: "edupath-local-docker-secret-change-before-public-release" }), /must not use a documented placeholder/);
});

test("production configuration requires PostgreSQL and cloud identity/storage", () => {
  assert.throws(() => loadConfig({ ...validProduction, DATABASE_URL: undefined }), /DATABASE_URL is required/);
  assert.throws(() => loadConfig({ ...validProduction, FIREBASE_PROJECT_ID: undefined }), /FIREBASE_PROJECT_ID is required/);
  assert.throws(() => loadConfig({ ...validProduction, SUPABASE_SERVICE_ROLE_KEY: undefined }), /SUPABASE_SERVICE_ROLE_KEY is required/);
});

test("production configuration rejects insecure browser origins by default", () => {
  assert.throws(() => loadConfig({ ...validProduction, WEB_ORIGINS: "http://192.168.0.10:5173" }), /must use HTTPS/);
  assert.doesNotThrow(() => loadConfig({ ...validProduction, WEB_ORIGINS: "http://192.168.0.10:5173", ALLOW_INSECURE_WEB_ORIGINS: "true" }));
});

test("production configuration rejects malformed origins and shutdown timeouts", () => {
  assert.throws(() => loadConfig({ ...validProduction, WEB_ORIGINS: "https://app.edupath.example/login" }), /must not include a path/);
  assert.throws(() => loadConfig({ ...validProduction, SHUTDOWN_TIMEOUT_MS: "0" }), /between 1000 and 120000/);
});

test("valid production configuration enables strict runtime defaults", () => {
  const config = loadConfig(validProduction);
  assert.equal(config.demoMode, false);
  assert.equal(config.trustProxy, true);
  assert.equal(config.logRequests, true);
  assert.equal(config.webOrigins.length, 3);
});
