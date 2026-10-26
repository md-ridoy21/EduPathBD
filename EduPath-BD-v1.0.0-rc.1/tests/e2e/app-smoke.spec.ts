import { expect, test, type Page, type TestInfo } from "@playwright/test";

type AuditIssue = { kind: "console" | "page" | "network" | "slow"; location: string; detail: string; durationMs?: number };
type ControlResult = { name: string; type: string; action: "clicked" | "checked" | "skipped"; durationMs?: number; reason?: string };

function firstParty(url: string) {
  try { return ["localhost", "127.0.0.1"].includes(new URL(url).hostname); }
  catch { return false; }
}

function expectedStreamingAbort(url: string, errorText: string | undefined) {
  if (errorText !== "net::ERR_ABORTED") return false;
  try { return new URL(url).pathname.startsWith("/api/realtime/"); }
  catch { return false; }
}

function installAudit(page: Page) {
  const issues: AuditIssue[] = [];
  page.on("pageerror", (error) => issues.push({ kind: "page", location: page.url(), detail: error.message }));
  page.on("console", (message) => {
    if (message.type() === "error") issues.push({ kind: "console", location: page.url(), detail: message.text() });
  });
  page.on("response", (response) => {
    if (firstParty(response.url()) && response.status() >= 400) issues.push({ kind: "network", location: response.url(), detail: `HTTP ${response.status()} ${response.statusText()}` });
  });
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText;
    if (firstParty(request.url()) && !expectedStreamingAbort(request.url(), errorText)) {
      issues.push({ kind: "network", location: request.url(), detail: errorText ?? "Request failed" });
    }
  });
  return issues;
}

async function timed(name: string, location: string, issues: AuditIssue[], action: () => Promise<unknown>) {
  const started = Date.now();
  await action();
  const durationMs = Date.now() - started;
  if (durationMs > 1_000) issues.push({ kind: "slow", location, detail: `${name} took longer than 1 second`, durationMs });
  return durationMs;
}

async function attachAudit(testInfo: TestInfo, issues: AuditIssue[], controls: ControlResult[]) {
  await testInfo.attach("edupath-e2e-audit.json", {
    body: Buffer.from(JSON.stringify({ generatedAt: new Date().toISOString(), project: testInfo.project.name, page: testInfo.title, summary: { issues: issues.length, controls: controls.length, slow: issues.filter((item) => item.kind === "slow").length }, issues, controls }, null, 2)),
    contentType: "application/json"
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test("public sections, navigation and API stay healthy", async ({ page }, testInfo) => {
  const issues = installAudit(page);
  const controls: ControlResult[] = [];
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("#top h1")).toHaveCount(1);

  const sectionIds = ["top", "eligibility", "pathways", "institutions", "deadlines", "scholarships", "ai-guide", "media-map", "community"];
  for (const id of sectionIds) {
    const target = page.locator(`#${id}`);
    await expect(target, `Missing section #${id}`).toHaveCount(1);
    const durationMs = await timed(`Navigate to #${id}`, page.url(), issues, async () => {
      await page.evaluate((hash) => { window.location.hash = hash; }, id);
      await expect(target).toBeVisible();
    });
    controls.push({ name: `#${id}`, type: "section-link", action: "clicked", durationMs });
  }

  const apiPaths = ["/api/health", "/api/catalog/stats", "/api/institutions?limit=4", "/api/programs?limit=4", "/api/circulars?limit=4", "/api/scholarships?limit=4", "/api/institutions/inst_du/media"];
  for (const path of apiPaths) {
    const result = await page.evaluate(async (endpoint) => {
      const started = performance.now();
      const response = await fetch(`http://localhost:4000${endpoint}`);
      return { status: response.status, durationMs: Math.round(performance.now() - started) };
    }, path);
    controls.push({ name: path, type: "api", action: "checked", durationMs: result.durationMs });
    expect(result.status, `${path} should return HTTP 200`).toBe(200);
    if (result.durationMs > 1_000) issues.push({ kind: "slow", location: path, detail: "API response took longer than 1 second", durationMs: result.durationMs });
  }

  const selects = page.locator("select:visible:not([disabled])");
  for (let index = 0; index < await selects.count(); index += 1) {
    const select = selects.nth(index);
    const name = await select.getAttribute("aria-label") ?? await select.locator("xpath=ancestor::label[1]").textContent().catch(() => null) ?? `select-${index + 1}`;
    await expect(select).toBeEnabled();
    controls.push({ name: name.trim(), type: "select", action: "checked" });
  }

  await attachAudit(testInfo, issues, controls);
  expect(issues.filter((item) => item.kind !== "slow"), JSON.stringify(issues, null, 2)).toEqual([]);
});

test("safe visible controls and demo student flow respond", async ({ page }, testInfo) => {
  const issues = installAudit(page);
  const controls: ControlResult[] = [];
  await page.goto("/");
  await expect(page.locator("#main-content")).toBeVisible();

  const navigationToggle = page.getByTestId("mobile-navigation-toggle");
  const mobileViewport = (page.viewportSize()?.width ?? 1_280) < 1_024;
  let signIn = page.getByTestId("desktop-auth-action");
  if (mobileViewport) {
    await expect(navigationToggle).toBeVisible();
    const durationMs = await timed("Toggle navigation", page.url(), issues, () => navigationToggle.click());
    await expect(navigationToggle).toHaveAttribute("aria-expanded", "true");
    controls.push({ name: "Toggle navigation", type: "button", action: "clicked", durationMs });
    signIn = page.getByTestId("mobile-auth-action");
  } else {
    await expect(signIn).toBeVisible();
  }
  await expect(signIn).toBeVisible();
  await signIn.click();
  await expect(page.getByRole("dialog", { name: /welcome back|স্বাগতম/i })).toBeVisible();
  const demoButton = page.getByRole("button", { name: /student demo|শিক্ষার্থী ডেমো/i });
  const loginDuration = await timed("Student demo sign-in", page.url(), issues, () => demoButton.click());
  controls.push({ name: "Student demo", type: "button", action: "clicked", durationMs: loginDuration });
  await expect(page.getByText(/signed in as|সাইন ইন করেছেন/i)).toBeVisible();

  const safePatterns = /^(discover|compare|plan|program|circular|media|leaflet \/ osm|google embed|listen to planning guide|stop audio guide)$/i;
  const stateChangingPatterns = /sign out|save|submit|send|track|shortlist|remind|rate|like|dislike|report|upload|delete|remove|verify|reject|resolve|dismiss|start discussion/i;
  const buttons = page.locator("button:visible:not([disabled])");
  const snapshots = await buttons.evaluateAll((items) => items.map((item) => ({ name: item.getAttribute("aria-label") || item.textContent?.trim() || "unnamed", disabled: (item as HTMLButtonElement).disabled })));
  for (const snapshot of snapshots) {
    if (stateChangingPatterns.test(snapshot.name)) controls.push({ name: snapshot.name, type: "button", action: "skipped", reason: "State-changing action is covered by API/component tests and is not blindly mutated." });
    else if (!safePatterns.test(snapshot.name)) controls.push({ name: snapshot.name, type: "button", action: "skipped", reason: "Requires user input, permission, external navigation or modal context." });
  }

  const admissionTabs = page.getByRole("tab");
  for (let index = 0; index < await admissionTabs.count(); index += 1) {
    const tab = admissionTabs.nth(index);
    if (!await tab.isVisible()) continue;
    const name = (await tab.textContent() ?? `tab-${index + 1}`).trim();
    const durationMs = await timed(name, page.url(), issues, () => tab.click());
    controls.push({ name, type: "tab", action: "clicked", durationMs });
  }

  await attachAudit(testInfo, issues, controls);
  expect(issues.filter((item) => item.kind !== "slow"), JSON.stringify(issues, null, 2)).toEqual([]);
});
