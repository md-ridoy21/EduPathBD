import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("AI production defaults, citations and fallback logging remain safe", async () => {
  const [config, assistant, server, store] = await Promise.all([
    readFile(new URL("../../apps/api/src/config.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/api/src/ai/assistant.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/api/src/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../../apps/api/src/data/store.ts", import.meta.url), "utf8")
  ]);

  assert.match(config, /geminiModel: env\.GEMINI_MODEL \?\? "gemini-3\.5-flash-lite"/);
  assert.match(server, /url: item\.sourceUrl \?\? ""/);
  assert.match(store, /sourceUrl: item\.sourceUrl \?\? undefined/);
  assert.match(store, /rule\?\.minimumSscGpa/);
  assert.match(assistant, /event: "ai\.gemini_fallback"/);
  assert.match(assistant, /category: error instanceof GeminiRequestError/);
  assert.doesNotMatch(assistant, /console\.(?:warn|error)\([^\n]*(?:prompt|geminiApiKey|response\.text)/);
});
