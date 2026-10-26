import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Account & privacy dialog exposes a stable purpose-based accessible name", async () => {
  const source = await readFile("apps/web/src/components/AccountCenter.tsx", "utf8");
  assert.match(source, /role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="account-center-label"/);
  assert.match(source, /id="account-center-label"[^>]*>\{text\("Account & privacy", "অ্যাকাউন্ট ও প্রাইভেসি"\)\}<\/span>/);
  assert.match(source, /id="account-center-user-name"[^>]*>\{session\.user\.displayName\}<\/h2>/);
  assert.doesNotMatch(source, /aria-labelledby="account-center-title"/);
});

test("critical modal accessible-name targets exist in their source files", async () => {
  const files = [
    "apps/web/src/components/AuthModal.tsx",
    "apps/web/src/components/AccountCenter.tsx",
    "apps/web/src/components/AdminDashboard.tsx",
    "apps/web/src/components/DeviceCheckModal.tsx",
    "apps/web/src/components/CommunityHub.tsx",
    "apps/web/src/components/QualityAuditPanel.tsx"
  ];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/aria-labelledby="([^"]+)"/g)) {
      const id = match[1];
      assert.ok(source.includes(`id="${id}"`), `${file}: aria-labelledby target ${id} must exist`);
    }
  }
});

test("authenticated shell structurally prevents the auth modal from reopening behind the account flow", async () => {
  const app = await readFile("apps/web/src/App.tsx", "utf8");
  const auth = await readFile("apps/web/src/components/AuthModal.tsx", "utf8");
  const e2e = await readFile("tests/e2e/app-smoke.spec.ts", "utf8");
  assert.match(app, /<AuthModal open=\{authOpen && !session\}/);
  assert.match(auth, /data-testid="auth-modal-overlay"/);
  assert.match(e2e, /getByTestId\("auth-modal-overlay"\)/);
  assert.match(e2e, /name: \/account & privacy\|অ্যাকাউন্ট ও প্রাইভেসি\/i/);
});
