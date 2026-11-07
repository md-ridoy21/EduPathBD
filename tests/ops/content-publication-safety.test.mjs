import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), 'utf8');

test('AdmissionRule has independent publication lifecycle', async () => {
  const schema = await read('apps/api/prisma/schema.prisma');
  assert.match(schema, /model AdmissionRule[\s\S]*verificationStatus\s+VerificationStatus\s+@default\(PENDING\)/);
  assert.match(schema, /model AdmissionRule[\s\S]*verifiedAt\s+DateTime\?/);
});

test('official catalog import is draft by default and verified publish is explicit', async () => {
  const importer = await read('apps/api/scripts/import-official-catalog.ts');
  assert.match(importer, /ALLOW_VERIFIED_CATALOG_IMPORT/);
  assert.match(importer, /publishVerified \? "VERIFIED" : "DRAFT"/);
  assert.doesNotMatch(importer, /verificationStatus:\s*"VERIFIED" as const/);
  assert.match(importer, /Ambiguous institution official code/);
});

test('public catalog only consumes verified rules and verified scholarship parents', async () => {
  const store = await read('apps/api/src/data/store.ts');
  assert.match(store, /admissionRules:\s*\{\s*some:\s*\{\s*verificationStatus:\s*"VERIFIED"/);
  assert.match(store, /admissionRules:\s*\{\s*where:\s*\{\s*verificationStatus:\s*"VERIFIED"/);
  assert.match(store, /verificationStatus:\s*"VERIFIED" as const[\s\S]*institution:[\s\S]*program:/);
});

test('admin content lifecycle includes admission rules and scholarships', async () => {
  const store = await read('apps/api/src/data/store.ts');
  const server = await read('apps/api/src/server.ts');
  assert.match(store, /"ADMISSION_RULE" \| "CIRCULAR" \| "SCHOLARSHIP"/);
  assert.match(server, /ADMISSION_RULE/);
  assert.match(server, /SCHOLARSHIP/);
  assert.match(store, /assertPublishParents/);
});

test('discussion comments cannot bypass parent publication status', async () => {
  const store = await read('apps/api/src/data/store.ts');
  assert.match(store, /async function assertVisibleDiscussionPost/);
  assert.match(store, /await assertVisibleDiscussionPost\(postId\)/);
  assert.match(store, /await assertVisibleDiscussionPost\(comment\.postId\)/);
});
