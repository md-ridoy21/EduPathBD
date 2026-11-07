#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const argValue = (name) => {
  const pair = args.find((item) => item.startsWith(`${name}=`));
  if (pair) return pair.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const rawUrl = argValue("--api-url") ?? process.env.EDUPATH_API_URL ?? process.env.VITE_API_URL;
const allowHttp = args.includes("--allow-http");
const expectedOrigin = argValue("--origin") ?? process.env.EDUPATH_EXPECTED_ORIGIN;
const failures = [];
const passes = [];
if (!rawUrl) throw new Error("Usage: npm run production:runtime-check -- --api-url https://api.example.com [--origin https://app.example.com]");
const base = new URL(rawUrl);
if (!allowHttp && base.protocol !== "https:") throw new Error("Production runtime verification requires HTTPS. Use --allow-http only for a private staging check.");
if (!allowHttp && ["localhost", "127.0.0.1"].includes(base.hostname)) throw new Error("Production runtime verification refuses localhost without --allow-http.");

async function request(path) {
  const response = await fetch(new URL(path, base), { headers: expectedOrigin ? { Origin: expectedOrigin } : undefined, signal: AbortSignal.timeout(12_000) });
  return { response, body: await response.json() };
}
function check(condition, message) { (condition ? passes : failures).push(message); console.log(`${condition ? "PASS" : "FAIL"}: ${message}`); }

try {
  const health = await request("/api/health");
  check(health.response.ok && health.body?.status === "alive", "liveness endpoint responds successfully");
  check(health.body?.version === packageJson.version, `deployed API reports ${packageJson.version}`);
  check(Boolean(health.response.headers.get("x-request-id")), "health response carries X-Request-Id");
  const ready = await request("/api/ready");
  check(ready.response.ok && ready.body?.status === "ready", "readiness endpoint reports ready");
  check(ready.body?.integrations?.demoMode === false, "runtime is not using demo-memory mode");
  check(ready.body?.integrations?.database === true, "runtime reports PostgreSQL");
  const catalog = await request("/api/catalog/stats");
  check(catalog.response.ok && typeof catalog.body === "object", "public catalog is reachable");
  if (expectedOrigin) check(health.response.headers.get("access-control-allow-origin") === expectedOrigin, `CORS allows ${expectedOrigin}`);
} catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
console.log(`\nRuntime verification: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
