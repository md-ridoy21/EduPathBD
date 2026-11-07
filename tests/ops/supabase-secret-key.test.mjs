import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server storage prefers current Supabase secret keys", async () => {
  const [config, storage, compose, example] = await Promise.all([
    readFile(new URL("../../apps/api/src/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/api/src/storage/media.ts", import.meta.url), "utf8"),
    readFile(new URL("../../docker-compose.yml", import.meta.url), "utf8"),
    readFile(new URL("../../.env.production.example", import.meta.url), "utf8")
  ]);

  assert.match(config, /env\.SUPABASE_SECRET_KEY \?\? env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(storage, /config\.supabaseSecretKey/);
  assert.match(compose, /SUPABASE_SECRET_KEY: \$\{SUPABASE_SECRET_KEY:\?/);
  assert.match(example, /SUPABASE_SECRET_KEY=sb_secret_/);
});
