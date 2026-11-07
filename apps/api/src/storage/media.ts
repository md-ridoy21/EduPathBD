import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg"]);
const managedStorageProtocol = "supabase-storage:";
const signedUrlLifetimeSeconds = 60 * 60;

type ManagedStorageLocation = { bucket: string; path: string };

function storageClient() {
  if (!config.supabaseUrl || !config.supabaseSecretKey) throw new Error("Supabase Storage is not configured");
  return createClient(config.supabaseUrl, config.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

export function managedStorageUrl(bucket: string, path: string) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(bucket)) throw new Error("Storage bucket name is invalid");
  const parts = path.split("/");
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) throw new Error("Storage object path is invalid");
  return `${managedStorageProtocol}//${bucket}/${parts.map(encodeURIComponent).join("/")}`;
}

export function parseManagedStorageUrl(value: string): ManagedStorageLocation | undefined {
  let parsed: URL;
  try { parsed = new URL(value); }
  catch { return undefined; }
  if (parsed.protocol !== managedStorageProtocol) return undefined;
  const bucket = parsed.hostname;
  const path = parsed.pathname.slice(1).split("/").map((part) => decodeURIComponent(part)).join("/");
  if (!bucket || !path || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) throw new Error("Managed storage reference is invalid");
  const canonical = managedStorageUrl(bucket, path);
  if (canonical !== value) throw new Error("Managed storage reference is not canonical");
  return { bucket, path };
}

export function isManagedStorageUrl(value: string | undefined): value is string {
  if (!value) return false;
  try { return Boolean(parseManagedStorageUrl(value)); }
  catch { return false; }
}

export async function resolveMediaUrl(value: string) {
  const location = parseManagedStorageUrl(value);
  if (!location) return value;
  if (location.bucket !== config.supabaseStorageBucket) throw new Error("Managed storage bucket does not match the configured bucket");
  const result = await storageClient().from(location.bucket).createSignedUrl(location.path, signedUrlLifetimeSeconds);
  if (result.error || !result.data?.signedUrl) throw result.error ?? new Error("Could not create a temporary media URL");
  return result.data.signedUrl;
}

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
    const url = `data:${input.mimeType};base64,${bytes.toString("base64")}`;
    return { fileName: safeName, mimeType: input.mimeType, size: bytes.length, url, storedUrl: url, storagePath: `demo/${input.userId}/${safeName}`, mode: "demo" as const };
  }
  const storage = storageClient();
  const storagePath = `${input.userId}/${Date.now()}-${safeName}`;
  const result = await storage.from(config.supabaseStorageBucket).upload(storagePath, bytes, { contentType: input.mimeType, upsert: false });
  if (result.error) throw result.error;
  const storedUrl = managedStorageUrl(config.supabaseStorageBucket, storagePath);
  const url = await resolveMediaUrl(storedUrl);
  return { fileName: safeName, mimeType: input.mimeType, size: bytes.length, url, storedUrl, storagePath, mode: "supabase" as const };
}
