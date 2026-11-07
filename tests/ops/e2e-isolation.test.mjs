import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Playwright acceptance owns isolated deterministic services", async () => {
  const config = await readFile("playwright.config.ts", "utf8");
  const vite = await readFile("apps/web/vite.config.ts", "utf8");
  const suite = await readFile("tests/e2e/app-smoke.spec.ts", "utf8");

  assert.match(config, /e2eApiPort = 4180/);
  assert.match(config, /e2eWebPort = 5178/);
  assert.match(config, /DEMO_MODE=true/);
  assert.match(config, /WEB_ORIGINS=\$\{e2eWebUrl\}/);
  assert.match(config, /reuseExistingServer: false/g);
  assert.match(config, /--strictPort/);
  assert.match(vite, /process\.env\.VITE_PROXY_TARGET/);
  assert.match(suite, /fetch\(endpoint\)/);
  assert.doesNotMatch(suite, /fetch\(`http:\/\/localhost:4000/);
});
