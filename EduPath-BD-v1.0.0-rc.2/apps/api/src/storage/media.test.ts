import assert from "node:assert/strict";
import test from "node:test";
import { managedStorageUrl, MediaValidationError, parseManagedStorageUrl, uploadMedia } from "./media.js";

test("valid PDF content is accepted in demo storage", async () => {
  const base64 = Buffer.from("%PDF-1.4\nEduPath test document").toString("base64");
  const result = await uploadMedia({ userId: "test-user", fileName: "Requirements PDF.pdf", mimeType: "application/pdf", base64 });
  assert.equal(result.mimeType, "application/pdf");
  assert.equal(result.mode, "demo");
  assert.equal(result.storedUrl, result.url);
  assert.match(result.fileName, /^requirements-pdf\.pdf$/);
});

test("private storage references round-trip without exposing a public URL", () => {
  const value = managedStorageUrl("edupath-media", "user-1/guide বাংলা.ogg");
  assert.equal(value, "supabase-storage://edupath-media/user-1/guide%20%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE.ogg");
  assert.deepEqual(parseManagedStorageUrl(value), { bucket: "edupath-media", path: "user-1/guide বাংলা.ogg" });
  assert.equal(parseManagedStorageUrl("https://cdn.example/guide.ogg"), undefined);
  assert.throws(() => managedStorageUrl("edupath-media", "../secret.txt"), /path is invalid/);
});

test("spoofed file content is rejected before storage", async () => {
  const base64 = Buffer.from("This is not actually a PDF").toString("base64");
  await assert.rejects(
    uploadMedia({ userId: "test-user", fileName: "fake.pdf", mimeType: "application/pdf", base64 }),
    (error: unknown) => error instanceof MediaValidationError && /does not match/.test(error.message)
  );
});

test("common browser WAV MIME alias is normalized safely", async () => {
  const wavHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
  const result = await uploadMedia({ userId: "test-user", fileName: "guide.wav", mimeType: "audio/wav", base64: `data:audio/x-wav;base64,${wavHeader.toString("base64")}` });
  assert.equal(result.mimeType, "audio/wav");
  assert.equal(result.mode, "demo");
});
