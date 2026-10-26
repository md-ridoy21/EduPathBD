import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg"]);

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

function matchesSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "audio/wav") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE";
  if (mimeType === "audio/ogg") return bytes.subarray(0, 4).toString("ascii") === "OggS";
  if (mimeType === "audio/mpeg") return bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0);
  return false;
}

function decodeUpload(base64: string, mimeType: string) {
  const dataUrl = base64.match(/^data:([^;,]*);base64,([A-Za-z0-9+/=\r\n]+)$/);
  const encoded = (dataUrl?.[2] ?? base64).replace(/\s+/g, "");
  const sourceMime = dataUrl?.[1]?.toLowerCase();
  const normalizedSourceMime = sourceMime === "audio/x-wav" ? "audio/wav" : sourceMime;
  if (normalizedSourceMime && normalizedSourceMime !== "application/octet-stream" && normalizedSourceMime !== mimeType) throw new MediaValidationError("The selected file type does not match its upload data");
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new MediaValidationError("The selected file is not valid base64 data");
  return Buffer.from(encoded, "base64");
}

export async function uploadMedia(input: { userId: string; fileName: string; mimeType: string; base64: string }) {
  if (!allowedMimeTypes.has(input.mimeType)) throw new MediaValidationError("Only PDF, JPG, PNG, WebP, MP3, WAV and OGG files are allowed");
  const bytes = decodeUpload(input.base64, input.mimeType);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new MediaValidationError("File must be between 1 byte and 5 MB");
  if (!matchesSignature(bytes, input.mimeType)) throw new MediaValidationError("The file content does not match the selected file type");
  const safeName = input.fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "").slice(-100) || "upload.bin";

  if (config.demoMode) {
    return { fileName: safeName, mimeType: input.mimeType, size: bytes.length, url: `data:${input.mimeType};base64,${bytes.toString("base64")}`, storagePath: `demo/${input.userId}/${safeName}`, mode: "demo" as const };
  }
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) throw new Error("Supabase Storage is not configured");
  const storage = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const storagePath = `${input.userId}/${Date.now()}-${safeName}`;
  const result = await storage.from(config.supabaseStorageBucket).upload(storagePath, bytes, { contentType: input.mimeType, upsert: false });
  if (result.error) throw result.error;
  const { data } = storage.from(config.supabaseStorageBucket).getPublicUrl(storagePath);
  return { fileName: safeName, mimeType: input.mimeType, size: bytes.length, url: data.publicUrl, storagePath, mode: "supabase" as const };
}
