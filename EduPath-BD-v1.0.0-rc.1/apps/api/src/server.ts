import "dotenv/config";
import { randomUUID } from "node:crypto";
import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { Server as SocketServer } from "socket.io";
import type { InstitutionType, ReportStatus, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { verifyFirebaseIdentity } from "./auth/firebase.js";
import { answerEducationQuestion, type KnowledgeSource } from "./ai/assistant.js";
import { issueAppToken } from "./auth/jwt.js";
import { optionalAuth, requireAuth, requireRole } from "./auth/middleware.js";
import { config, integrationStatus } from "./config.js";
import {
  createDemoSessionUser,
  checkDataStoreReady,
  createDiscussionComment,
  createContentReport,
  createInstitutionDiscussion,
  createCircular,
  createInstitution,
  createMediaResource,
  createProgram,
  disconnectDataStore,
  getAdminStats,
  getAdminAnalytics,
  getCatalogStats,
  getCircular,
  getInstitution,
  getInstitutionDiscussion,
  getInstitutionRating,
  isUsernameTaken,
  listApplications,
  listAdminContent,
  listContentReports,
  listCirculars,
  listDiscussionComments,
  listEligibilityRules,
  listInstitutions,
  listVerifiedMedia,
  listPrograms,
  listScholarships,
  listSavedInstitutions,
  removeSavedInstitution,
  rateInstitution,
  recordAiInteraction,
  recordUploadedMedia,
  reserveFirebaseUser,
  saveInstitution,
  startApplication,
  syncFirebaseUser,
  toggleApplicationDocument,
  updateApplicationStatus,
  updateAdminContent,
  updateContentVerification,
  updateContentReportStatus,
  voteOnComment,
  UsernameConflictError
} from "./data/store.js";
import { APP_VERSION } from "./version.js";
import { eligibilitySchema, evaluateEligibility } from "./domain/eligibility.js";
import { publishToChannel, subscribeToChannel } from "./realtime/hub.js";
import { MediaValidationError, uploadMedia } from "./storage/media.js";
import { analyticsToCsv, moderationToCsv } from "./reporting/csv.js";
import { rateLimit } from "./security/rate-limit.js";
import { CsvImportError, parseCsv } from "./import/csv.js";

const app = express();
const httpServer = http.createServer(app);
const allowedOrigins = new Set(config.webOrigins);
const originAllowed = (origin: string | undefined) => !origin || allowedOrigins.has(origin);
const io = new SocketServer(httpServer, { cors: { origin: (origin, callback) => callback(null, originAllowed(origin)), credentials: true } });
const port = config.port;

app.disable("x-powered-by");
if (config.trustProxy) app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (origin, callback) => callback(null, originAllowed(origin)), credentials: true }));
app.use(express.json({ limit: "8mb" }));
app.use((request, response, next) => {
  const requestId = randomUUID();
  const startedAt = performance.now();
  response.setHeader("X-Request-Id", requestId);
  response.on("finish", () => {
    if (!config.logRequests) return;
    console.log(JSON.stringify({
      level: "info",
      event: "request.completed",
      requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    }));
  });
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, keyPrefix: "auth" });
const writeLimiter = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "write" });
const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, keyPrefix: "ai" });
const uploadLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "upload" });

app.get("/api/health", (_request, response) => {
  response.json({ status: "alive", service: "edupath-api", version: APP_VERSION, integrations: integrationStatus, timestamp: new Date().toISOString() });
});

app.get("/api/ready", async (_request, response) => {
  try {
    const dataStore = await checkDataStoreReady();
    response.json({ status: "ready", service: "edupath-api", version: APP_VERSION, dataStore, integrations: integrationStatus, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error(JSON.stringify({ level: "error", event: "readiness.failed", message: error instanceof Error ? error.message : String(error) }));
    response.status(503).json({ status: "not-ready", service: "edupath-api", version: APP_VERSION, timestamp: new Date().toISOString() });
  }
});

app.get("/api/catalog/stats", async (_request, response, next) => {
  try {
    response.json(await getCatalogStats());
  } catch (error) {
    next(error);
  }
});

app.get("/api/scholarships", async (request, response, next) => {
  const parsed = z.object({
    gpa: z.coerce.number().min(0).max(5).optional(),
    group: z.string().trim().min(2).max(40).optional(),
    level: z.enum(["SSC", "HSC", "UNDERGRADUATE"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(20).default(10)
  }).safeParse(request.query);
  if (!parsed.success) { response.status(400).json({ message: "Invalid scholarship filters", issues: parsed.error.flatten() }); return; }
  try {
    const { page, limit, ...filters } = parsed.data;
    const result = await listScholarships({ ...filters, page, limit });
    response.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) { next(error); }
});

function broadcast(channel: string, event: string, payload: unknown) {
  publishToChannel(channel, event, payload);
  io.to(channel).emit(event, payload);
}

app.get("/api/realtime/:scope/:id", (request, response) => {
  const scope = String(request.params.scope);
  if (!new Set(["discussion", "institution"]).has(scope)) {
    response.status(400).json({ message: "Invalid real-time channel" });
    return;
  }
  subscribeToChannel(`${scope}:${String(request.params.id)}`, response);
});

const institutionTypes = ["SCHOOL", "COLLEGE", "PUBLIC_UNIVERSITY", "PRIVATE_UNIVERSITY", "ENGINEERING", "MEDICAL", "NATIONAL_UNIVERSITY_COLLEGE", "POLYTECHNIC", "TECHNICAL", "TRAINING_PROVIDER"] as const;
const adminContentKinds = ["INSTITUTION", "PROGRAM", "CIRCULAR", "MEDIA"] as const;
const verificationStatuses = ["DRAFT", "PENDING", "VERIFIED", "OUTDATED", "REJECTED"] as const;

app.get("/api/institutions", async (request, response, next) => {
  const search = String(request.query.search ?? "").trim();
  const page = Math.max(1, Number(request.query.page ?? 1));
  const limit = Math.min(20, Math.max(1, Number(request.query.limit ?? 10)));
  const type = String(request.query.type ?? "") || undefined;
  const district = String(request.query.district ?? "") || undefined;
  if (type && !institutionTypes.includes(type as typeof institutionTypes[number])) {
    response.status(400).json({ message: "Invalid institution type" });
    return;
  }
  try {
    const result = await listInstitutions({ search, type: type as InstitutionType | undefined, district, page, limit });
    response.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/institutions/:institutionId/media", async (request, response, next) => {
  try { response.json({ data: await listVerifiedMedia(String(request.params.institutionId)) }); }
  catch (error) { next(error); }
});

app.get("/api/programs", async (request, response, next) => {
  const page = Math.max(1, Number(request.query.page ?? 1));
  const limit = Math.min(30, Math.max(1, Number(request.query.limit ?? 10)));
  const institutionType = String(request.query.type ?? "") || undefined;
  if (institutionType && !institutionTypes.includes(institutionType as typeof institutionTypes[number])) {
    response.status(400).json({ message: "Invalid institution type" });
    return;
  }
  try {
    const result = await listPrograms({ search: String(request.query.search ?? ""), institutionId: request.query.institutionId ? String(request.query.institutionId) : undefined, institutionType: institutionType as InstitutionType | undefined, district: request.query.district ? String(request.query.district) : undefined, level: request.query.level ? String(request.query.level) : undefined, group: request.query.group ? String(request.query.group) : undefined, page, limit });
    response.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/circulars", async (request, response, next) => {
  const page = Math.max(1, Number(request.query.page ?? 1));
  const limit = Math.min(20, Math.max(1, Number(request.query.limit ?? 10)));
  const from = request.query.from ? new Date(String(request.query.from)) : undefined;
  const to = request.query.to ? new Date(String(request.query.to)) : undefined;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    response.status(400).json({ message: "Invalid date filter" });
    return;
  }
  try {
    const result = await listCirculars({ from, to, page, limit });
    response.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) {
    next(error);
  }
});

const usernameSchema = z.string().regex(/^[a-z][a-z0-9_]{3,19}$/);
const reservedUsernames = new Set(["admin", "edupath", "student", "support"]);

app.get("/api/auth/username-availability", async (request, response, next) => {
  const username = String(request.query.username ?? "").trim().toLowerCase();
  const valid = /^[a-z][a-z0-9_]{3,19}$/.test(username);
  try {
    const taken = valid ? await isUsernameTaken(username) : false;
    response.json({ username, available: valid && !reservedUsernames.has(username) && !taken, valid, checkedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

const firebaseSessionSchema = z.object({
  idToken: z.string().min(20),
  username: usernameSchema.optional(),
  displayName: z.string().trim().min(2).max(80)
});

const firebaseRegistrationSchema = z.object({
  idToken: z.string().min(20),
  username: usernameSchema,
  displayName: z.string().trim().min(2).max(80)
});

app.post("/api/auth/register", authLimiter, async (request, response, next) => {
  const parsed = firebaseRegistrationSchema.safeParse(request.body);
  if (!parsed.success || reservedUsernames.has(parsed.data?.username ?? "")) {
    response.status(400).json({ message: "Invalid registration request", ...(parsed.success ? {} : { issues: parsed.error.flatten() }) });
    return;
  }
  try {
    const identity = await verifyFirebaseIdentity(parsed.data.idToken);
    const user = await reserveFirebaseUser({ ...identity, username: parsed.data.username, displayName: parsed.data.displayName });
    response.status(201).json({ user, reserved: true, emailVerificationRequired: !identity.emailVerified });
  } catch (error) {
    if (error instanceof UsernameConflictError) {
      response.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/session", authLimiter, async (request, response, next) => {
  const parsed = firebaseSessionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid session request", issues: parsed.error.flatten() });
    return;
  }
  try {
    const identity = await verifyFirebaseIdentity(parsed.data.idToken);
    if (!identity.emailVerified && !identity.phoneVerified) {
      response.status(403).json({ message: "Verify your email or phone before creating an EduPath session" });
      return;
    }
    const user = await syncFirebaseUser({ ...identity, username: parsed.data.username, displayName: parsed.data.displayName });
    const token = issueAppToken({ sub: user.id, username: user.username, email: user.email, displayName: user.displayName, role: user.role, emailVerified: user.emailVerified, phoneVerified: user.phoneVerified });
    response.json({ token, user });
  } catch (error) {
    next(error);
  }
});

const demoLoginSchema = z.object({
  username: z.string().regex(/^[a-z][a-z0-9_]{3,19}$/)
});

app.post("/api/auth/demo-login", authLimiter, async (request, response, next) => {
  if (!config.demoMode) {
    response.status(404).json({ message: "Route not found" });
    return;
  }
  const parsed = demoLoginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Enter a valid demo username", issues: parsed.error.flatten() });
    return;
  }
  try {
    const admin = parsed.data.username === "admin_demo";
    const user = await createDemoSessionUser(parsed.data.username, admin);
    const token = issueAppToken({ sub: user.id, username: user.username, email: user.email, displayName: user.displayName, role: user.role, emailVerified: user.emailVerified, phoneVerified: user.phoneVerified });
    response.json({ token, user, mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (request, response) => {
  response.json({ user: request.auth });
});

app.get("/api/institutions/:institutionId/discussion", optionalAuth, async (request, response, next) => {
  try {
    const discussion = await getInstitutionDiscussion(String(request.params.institutionId));
    response.json(discussion);
  } catch (error) { next(error); }
});

app.post("/api/institutions/:institutionId/discussion", requireAuth, writeLimiter, async (request, response, next) => {
  const parsed = z.object({ title: z.string().trim().min(5).max(140), body: z.string().trim().min(5).max(1000) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Invalid discussion", issues: parsed.error.flatten() }); return; }
  try {
    response.status(201).json(await createInstitutionDiscussion(request.auth!.sub, String(request.params.institutionId), parsed.data.title, parsed.data.body));
  } catch (error) { next(error); }
});

app.get("/api/discussions/:postId/comments", optionalAuth, async (request, response, next) => {
  const page = Math.max(1, Number(request.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(request.query.limit ?? 20)));
  try {
    const result = await listDiscussionComments(String(request.params.postId), request.auth?.sub, page, limit);
    response.json({ data: result.data, pagination: { page, limit, total: result.total, pages: Math.ceil(result.total / limit) } });
  } catch (error) { next(error); }
});

app.post("/api/discussions/:postId/comments", requireAuth, writeLimiter, async (request, response, next) => {
  const parsed = z.object({ body: z.string().trim().min(2).max(1000), parentId: z.string().min(3).optional() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Invalid comment", issues: parsed.error.flatten() }); return; }
  try {
    const postId = String(request.params.postId);
    const comment = await createDiscussionComment(postId, request.auth!.sub, parsed.data.body, parsed.data.parentId);
    broadcast(`discussion:${postId}`, "comment:created", comment);
    response.status(201).json(comment);
  } catch (error) { next(error); }
});

app.post("/api/comments/:commentId/vote", requireAuth, writeLimiter, async (request, response, next) => {
  const parsed = z.object({ type: z.enum(["LIKE", "DISLIKE"]).nullable() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Vote must be LIKE, DISLIKE or null" }); return; }
  try {
    const result = await voteOnComment(String(request.params.commentId), request.auth!.sub, parsed.data.type);
    broadcast(`discussion:${result.postId}`, "vote:updated", result);
    response.json(result);
  } catch (error) { next(error); }
});

app.post("/api/comments/:commentId/report", requireAuth, writeLimiter, async (request, response, next) => {
  const parsed = z.object({ reason: z.enum(["MISINFORMATION", "HARASSMENT", "SPAM", "PRIVACY", "VERIFY_SOURCE", "OTHER"]), details: z.string().trim().max(500).optional() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Select a valid report reason" }); return; }
  try {
    response.status(201).json(await createContentReport(request.auth!.sub, String(request.params.commentId), parsed.data.reason, parsed.data.details));
  } catch (error) { next(error); }
});

app.get("/api/institutions/:institutionId/rating", optionalAuth, async (request, response, next) => {
  try { response.json(await getInstitutionRating(String(request.params.institutionId), request.auth?.sub)); }
  catch (error) { next(error); }
});

app.post("/api/institutions/:institutionId/rating", requireAuth, writeLimiter, async (request, response, next) => {
  const parsed = z.object({ score: z.number().int().min(1).max(5), review: z.string().trim().max(600).optional() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Rating must be between 1 and 5" }); return; }
  try {
    const institutionId = String(request.params.institutionId);
    const result = await rateInstitution(institutionId, request.auth!.sub, parsed.data.score, parsed.data.review);
    broadcast(`institution:${institutionId}`, "rating:updated", result);
    response.json(result);
  } catch (error) { next(error); }
});

const mediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "audio/ogg"]),
  base64: z.string().min(4).max(7_100_000),
  institutionId: z.string().min(3).optional()
});

function mediaUploadRequestError(error: z.ZodError) {
  const field = error.issues[0]?.path[0];
  if (field === "fileName") return "File name is required and must be at most 160 characters";
  if (field === "mimeType") return "Only PDF, JPG, PNG, WebP, MP3, WAV and OGG files are allowed";
  if (field === "base64") return error.issues.some((issue) => issue.code === "too_big")
    ? "File must be 5 MB or smaller"
    : "The selected file is empty or unreadable";
  if (field === "institutionId") return "The selected institution reference is invalid";
  return "The upload request is invalid";
}

app.post("/api/media/upload", requireAuth, uploadLimiter, async (request, response, next) => {
  const parsed = mediaUploadSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: mediaUploadRequestError(parsed.error) }); return; }
  try {
    const uploaded = await uploadMedia({ userId: request.auth!.sub, fileName: parsed.data.fileName, mimeType: parsed.data.mimeType, base64: parsed.data.base64 });
    const media = await recordUploadedMedia({ institutionId: parsed.data.institutionId, title: uploaded.fileName, url: uploaded.url, mimeType: uploaded.mimeType });
    response.status(201).json({ ...uploaded, mediaId: media.id });
  }
  catch (error) {
    if (error instanceof MediaValidationError) {
      response.status(400).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/me/shortlist", requireAuth, async (request, response, next) => {
  try {
    response.json({ data: await listSavedInstitutions(request.auth!.sub) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/me/shortlist/:institutionId", requireAuth, async (request, response, next) => {
  try {
    response.status(201).json(await saveInstitution(request.auth!.sub, String(request.params.institutionId)));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/me/shortlist/:institutionId", requireAuth, async (request, response, next) => {
  try {
    response.json(await removeSavedInstitution(request.auth!.sub, String(request.params.institutionId)));
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/applications", requireAuth, async (request, response, next) => {
  try {
    response.json({ data: await listApplications(request.auth!.sub) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/me/applications", requireAuth, async (request, response, next) => {
  const parsed = z.object({ programId: z.string().min(3) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "A valid program is required" });
    return;
  }
  try {
    response.status(201).json(await startApplication(request.auth!.sub, parsed.data.programId));
  } catch (error) {
    next(error);
  }
});

const applicationStatuses = ["INTERESTED", "DOCUMENTS_PENDING", "READY_TO_APPLY", "APPLIED", "ADMIT_CARD_RECEIVED", "EXAM_COMPLETED", "RESULT_PUBLISHED", "SELECTED", "NOT_SELECTED"] as const;

app.patch("/api/me/applications/:applicationId/status", requireAuth, async (request, response, next) => {
  const parsed = z.object({ status: z.enum(applicationStatuses) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid application status" });
    return;
  }
  try {
    response.json(await updateApplicationStatus(request.auth!.sub, String(request.params.applicationId), parsed.data.status));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/me/applications/:applicationId/documents/:documentId", requireAuth, async (request, response, next) => {
  const parsed = z.object({ completed: z.boolean() }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Checklist completion must be true or false" });
    return;
  }
  try {
    response.json(await toggleApplicationDocument(request.auth!.sub, String(request.params.applicationId), String(request.params.documentId), parsed.data.completed));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/stats", requireAuth, requireRole("ADMIN", "MODERATOR"), async (_request, response, next) => {
  try {
    response.json(await getAdminStats());
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/analytics", requireAuth, requireRole("ADMIN", "MODERATOR"), async (_request, response, next) => {
  try { response.json(await getAdminAnalytics()); }
  catch (error) { next(error); }
});

app.get("/api/admin/moderation/reports", requireAuth, requireRole("ADMIN", "MODERATOR"), async (request, response, next) => {
  const status = request.query.status ? String(request.query.status) as ReportStatus : undefined;
  if (status && !["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status)) { response.status(400).json({ message: "Invalid report status" }); return; }
  try { response.json({ data: await listContentReports(status) }); }
  catch (error) { next(error); }
});

app.patch("/api/admin/moderation/reports/:reportId", requireAuth, requireRole("ADMIN", "MODERATOR"), async (request, response, next) => {
  const parsed = z.object({ status: z.enum(["REVIEWING", "RESOLVED", "DISMISSED"]), resolution: z.string().trim().max(500).optional() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Invalid moderation decision" }); return; }
  try { response.json(await updateContentReportStatus(String(request.params.reportId), request.auth!.sub, parsed.data.status, parsed.data.resolution)); }
  catch (error) { next(error); }
});

app.get("/api/admin/reporting/dataset", requireAuth, requireRole("ADMIN", "MODERATOR"), async (_request, response, next) => {
  try { response.json({ generatedAt: new Date().toISOString(), data: await getAdminAnalytics() }); }
  catch (error) { next(error); }
});

app.get("/api/admin/reporting/export.csv", requireAuth, requireRole("ADMIN", "MODERATOR"), async (request, response, next) => {
  try {
    const kind = String(request.query.kind ?? "analytics");
    const csv = kind === "moderation"
      ? moderationToCsv((await listContentReports()).map((item) => ({ ...item })))
      : analyticsToCsv(await getAdminAnalytics());
    response.setHeader("Content-Disposition", `attachment; filename=edupath-${kind}-${new Date().toISOString().slice(0, 10)}.csv`);
    response.type("text/csv").send(`\uFEFF${csv}`);
  } catch (error) { next(error); }
});

app.get("/api/admin/content", requireAuth, requireRole("ADMIN", "MODERATOR"), async (request, response, next) => {
  const kind = String(request.query.kind ?? "") || undefined;
  const status = String(request.query.status ?? "") || undefined;
  if (kind && !adminContentKinds.includes(kind as typeof adminContentKinds[number])) {
    response.status(400).json({ message: "Invalid content kind" });
    return;
  }
  if (status && !verificationStatuses.includes(status as typeof verificationStatuses[number])) {
    response.status(400).json({ message: "Invalid verification status" });
    return;
  }
  try {
    response.json({ data: await listAdminContent({ kind: kind as typeof adminContentKinds[number] | undefined, status: status as VerificationStatus | undefined }) });
  } catch (error) { next(error); }
});

function normalizeYouTubeUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let videoId = "";
  if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    videoId = url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] ?? "" : url.searchParams.get("v") ?? "";
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Use a valid YouTube watch, share or embed URL");
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

const mediaResourceSchema = z.object({
  institutionId: z.string().min(3).optional(),
  type: z.enum(["YOUTUBE", "AUDIO"]),
  title: z.string().trim().min(3).max(160),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  languageCode: z.enum(["en", "bn"]).optional()
}).superRefine((value, context) => {
  try {
    if (value.type === "YOUTUBE") normalizeYouTubeUrl(value.url);
    else {
      const url = new URL(value.url);
      if (url.protocol !== "https:" || !/\.(mp3|wav|ogg)$/i.test(url.pathname)) context.addIssue({ code: "custom", path: ["url"], message: "Audio must use a direct HTTPS MP3, WAV or OGG URL" });
    }
  } catch (error) { context.addIssue({ code: "custom", path: ["url"], message: error instanceof Error ? error.message : "Invalid media URL" }); }
});

app.post("/api/admin/media", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const parsed = mediaResourceSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid media resource", issues: parsed.error.flatten() }); return; }
  try {
    response.status(201).json(await createMediaResource({ ...parsed.data, url: parsed.data.type === "YOUTUBE" ? normalizeYouTubeUrl(parsed.data.url) : parsed.data.url }));
  } catch (error) { next(error); }
});

app.patch("/api/admin/content/:kind/:id/verification", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const kind = String(request.params.kind).toUpperCase();
  const parsed = z.object({ status: z.enum(verificationStatuses) }).safeParse(request.body);
  if (!adminContentKinds.includes(kind as typeof adminContentKinds[number]) || !parsed.success) {
    response.status(400).json({ message: "Invalid verification decision" });
    return;
  }
  try {
    response.json(await updateContentVerification(kind as typeof adminContentKinds[number], String(request.params.id), parsed.data.status, request.auth!.sub));
  } catch (error) { next(error); }
});

const institutionEditSchema = z.object({ name: z.string().trim().min(3).max(160).optional(), district: z.string().trim().min(2).max(80).optional(), sourceUrl: z.string().url().optional() }).refine((value) => Object.keys(value).length > 0);
const programEditSchema = z.object({ name: z.string().trim().min(2).max(160).optional(), level: z.string().trim().min(2).max(60).optional() }).refine((value) => Object.keys(value).length > 0);
const circularEditSchema = z.object({ title: z.string().trim().min(3).max(180).optional(), academicSession: z.string().trim().min(4).max(20).optional(), sourceUrl: z.string().url().optional() }).refine((value) => Object.keys(value).length > 0);
const mediaEditSchema = z.object({ title: z.string().trim().min(3).max(160).optional(), type: z.enum(["YOUTUBE", "AUDIO"]).optional(), url: z.string().url().optional(), languageCode: z.enum(["en", "bn"]).nullable().optional() }).refine((value) => Object.keys(value).length > 0).superRefine((value, context) => {
  if (!value.url) return;
  if (!value.type) { context.addIssue({ code: "custom", path: ["type"], message: "Media type is required when changing its URL" }); return; }
  try {
    if (value.type === "YOUTUBE") normalizeYouTubeUrl(value.url);
    else {
      const url = new URL(value.url);
      if (url.protocol !== "https:" || !/\.(mp3|wav|ogg)$/i.test(url.pathname)) context.addIssue({ code: "custom", path: ["url"], message: "Audio must use a direct HTTPS MP3, WAV or OGG URL" });
    }
  }
  catch (error) { context.addIssue({ code: "custom", path: ["url"], message: error instanceof Error ? error.message : "Invalid media URL" }); }
});

app.patch("/api/admin/content/:kind/:id", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const kind = String(request.params.kind).toUpperCase();
  if (!adminContentKinds.includes(kind as typeof adminContentKinds[number])) { response.status(400).json({ message: "Invalid content kind" }); return; }
  const schema = kind === "INSTITUTION" ? institutionEditSchema : kind === "PROGRAM" ? programEditSchema : kind === "CIRCULAR" ? circularEditSchema : mediaEditSchema;
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Invalid content changes", issues: parsed.error.flatten() }); return; }
  try {
    const changes = kind === "MEDIA" && "url" in parsed.data && parsed.data.url && "type" in parsed.data && parsed.data.type === "YOUTUBE" ? { ...parsed.data, url: normalizeYouTubeUrl(parsed.data.url) } : parsed.data;
    response.json(await updateAdminContent(kind as typeof adminContentKinds[number], String(request.params.id), changes, request.auth!.sub));
  }
  catch (error) { next(error); }
});

const institutionSchema = z.object({
  name: z.string().trim().min(3).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  type: z.enum(institutionTypes),
  district: z.string().trim().min(2).max(80),
  websiteUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional()
});

app.post("/api/admin/institutions", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const parsed = institutionSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid institution data", issues: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json(await createInstitution(parsed.data));
  } catch (error) {
    next(error);
  }
});

const institutionCsvSchema = z.object({ csv: z.string().min(1).max(200_000) });
const institutionCsvHeaders = new Set(["name", "slug", "type", "district", "websiteUrl", "sourceUrl"]);

app.post("/api/admin/import/institutions", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const parsedBody = institutionCsvSchema.safeParse(request.body);
  if (!parsedBody.success) { response.status(400).json({ message: "Attach a CSV file smaller than 200 KB" }); return; }
  try {
    const parsedCsv = parseCsv(parsedBody.data.csv, { maxRows: 100 });
    const required = ["name", "slug", "type", "district"];
    const unsupported = parsedCsv.headers.filter((header) => !institutionCsvHeaders.has(header));
    const missing = required.filter((header) => !parsedCsv.headers.includes(header));
    if (unsupported.length || missing.length) {
      response.status(400).json({ message: "CSV columns are not valid", missing, unsupported, expected: [...institutionCsvHeaders] });
      return;
    }

    const imported: Array<{ row: number; id: string; name: string }> = [];
    const errors: Array<{ row: number; message: string }> = [];
    for (const record of parsedCsv.records) {
      const candidate = institutionSchema.safeParse({
        name: record.values.name,
        slug: record.values.slug,
        type: record.values.type,
        district: record.values.district,
        ...(record.values.websiteUrl ? { websiteUrl: record.values.websiteUrl } : {}),
        ...(record.values.sourceUrl ? { sourceUrl: record.values.sourceUrl } : {})
      });
      if (!candidate.success) {
        errors.push({ row: record.row, message: candidate.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
        continue;
      }
      try {
        const item = await createInstitution(candidate.data);
        imported.push({ row: record.row, id: item.id, name: item.name });
      } catch (error) {
        errors.push({ row: record.row, message: error instanceof Error ? error.message : "Could not save this row" });
      }
    }
    response.status(errors.length ? 207 : 201).json({ imported, errors, totalRows: parsedCsv.records.length, draftStatus: "DRAFT" });
  } catch (error) {
    if (error instanceof CsvImportError) { response.status(400).json({ message: error.message }); return; }
    next(error);
  }
});

const programSchema = z.object({
  institutionId: z.string().min(3),
  name: z.string().trim().min(2).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  level: z.string().trim().min(2).max(60),
  durationMonths: z.number().int().positive().max(120).optional(),
  tuitionMin: z.number().int().nonnegative().optional(),
  tuitionMax: z.number().int().nonnegative().optional(),
  careerOutcomes: z.array(z.string().trim().min(2)).max(10).default([])
}).refine((value) => value.tuitionMin === undefined || value.tuitionMax === undefined || value.tuitionMin <= value.tuitionMax, {
  message: "Minimum tuition cannot exceed maximum tuition",
  path: ["tuitionMax"]
});

app.post("/api/admin/programs", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const parsed = programSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid program data", issues: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json(await createProgram(parsed.data));
  } catch (error) {
    next(error);
  }
});

const circularSchema = z.object({
  institutionId: z.string().min(3),
  programId: z.string().min(3).optional(),
  title: z.string().trim().min(3).max(180),
  academicSession: z.string().trim().min(4).max(20),
  applicationStartsAt: z.coerce.date().optional(),
  applicationEndsAt: z.coerce.date(),
  examAt: z.coerce.date().optional(),
  applicationFee: z.number().int().nonnegative().optional(),
  sourceUrl: z.string().url()
}).superRefine((value, context) => {
  if (value.applicationStartsAt && value.applicationStartsAt > value.applicationEndsAt) {
    context.addIssue({ code: "custom", message: "Application start must be on or before the deadline", path: ["applicationStartsAt"] });
  }
  if (value.examAt && value.examAt < value.applicationEndsAt) {
    context.addIssue({ code: "custom", message: "Exam date cannot be before the application deadline", path: ["examAt"] });
  }
});

app.post("/api/admin/circulars", requireAuth, requireRole("ADMIN"), async (request, response, next) => {
  const parsed = circularSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid circular data", issues: parsed.error.flatten() });
    return;
  }
  try {
    response.status(201).json(await createCircular(parsed.data));
  } catch (error) {
    next(error);
  }
});

app.post("/api/eligibility/evaluate", async (request, response, next) => {
  const parsed = eligibilitySchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: "Invalid academic profile", issues: parsed.error.flatten() });
    return;
  }

  try {
    const rules = await listEligibilityRules();
    const results = evaluateEligibility(parsed.data, rules);
    response.json({
      profile: parsed.data,
      rulesEvaluated: rules.length,
      engine: "database-admission-rules-v2",
      results,
      disclaimer: "Guidance only; always verify the latest official circular. Subject-grade and special criteria may still apply."
    });
  } catch (error) {
    next(error);
  }
});

async function getAssistantSources(): Promise<KnowledgeSource[]> {
  const [circulars, programs] = await Promise.all([listCirculars({ page: 1, limit: 20 }), listPrograms({ page: 1, limit: 30 })]);
  return [
    ...circulars.data.map((item) => ({
      id: item.id,
      title: `${item.institutionName} — ${item.title}`,
      detail: `Session ${item.academicSession}; application deadline ${new Date(item.applicationEndsAt).toLocaleDateString("en-GB")}${item.examAt ? `; exam ${new Date(item.examAt).toLocaleDateString("en-GB")}` : ""}${item.applicationFee !== undefined ? `; fee BDT ${item.applicationFee}` : ""}.`,
      url: item.sourceUrl,
      verified: item.verified
    })),
    ...programs.data.map((item) => ({
      id: item.id,
      title: `${item.institutionName} — ${item.name}`,
      detail: `${item.level}; groups: ${item.groups.join(", ") || "not specified"}; minimum recorded GPA ${item.minimumGpa}; duration ${item.durationMonths ? `${item.durationMonths} months` : "not specified"}; career outcomes: ${item.careerOutcomes.join(", ") || "not specified"}.`,
      url: "",
      verified: item.verified
    }))
  ].filter((item) => item.verified);
}

const aiQuestionSchema = z.object({ question: z.string().trim().min(5).max(600) });

app.post("/api/ai/ask", requireAuth, aiLimiter, async (request, response, next) => {
  const parsed = aiQuestionSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: "Ask a question between 5 and 600 characters" }); return; }
  try {
    const result = await answerEducationQuestion(parsed.data.question, await getAssistantSources());
    await recordAiInteraction({ userId: request.auth!.sub, feature: "education-assistant", prompt: parsed.data.question, response: result.answer, model: result.model, sourceIds: result.sources.map((item) => item.id), safetyNotice: result.safetyNotice });
    response.json(result);
  } catch (error) { next(error); }
});

app.post("/api/ai/circulars/:circularId/summary", requireAuth, aiLimiter, async (request, response, next) => {
  try {
    const circular = await getCircular(String(request.params.circularId));
    if (!circular) { response.status(404).json({ message: "Circular not found" }); return; }
    const source: KnowledgeSource = {
      id: circular.id,
      title: `${circular.institutionName} — ${circular.title}`,
      detail: `Academic session ${circular.academicSession}. Application opens ${circular.applicationStartsAt ? new Date(circular.applicationStartsAt).toLocaleDateString("en-GB") : "not recorded"}, closes ${new Date(circular.applicationEndsAt).toLocaleDateString("en-GB")}, exam ${circular.examAt ? new Date(circular.examAt).toLocaleDateString("en-GB") : "not recorded"}, fee ${circular.applicationFee !== undefined ? `BDT ${circular.applicationFee}` : "not recorded"}. Verification: ${circular.verified ? "verified" : "pending"}.`,
      url: circular.sourceUrl,
      verified: circular.verified
    };
    const result = await answerEducationQuestion("Summarize this admission circular in Bangla with key dates, fee, verification state and an action checklist.", [source]);
    await recordAiInteraction({ userId: request.auth!.sub, feature: "circular-summary", prompt: circular.title, response: result.answer, model: result.model, sourceIds: [circular.id], safetyNotice: result.safetyNotice });
    response.json(result);
  } catch (error) { next(error); }
});

const typeDefs = `#graphql
  type Institution {
    id: ID!
    name: String!
    type: String!
    district: String!
    verified: Boolean!
  }

  type Query {
    institutions(search: String, district: String): [Institution!]!
    institution(id: ID!): Institution
  }
`;

const resolvers = {
  Query: {
    institutions: async (_parent: unknown, args: { search?: string; district?: string }) => (await listInstitutions({ search: args.search, district: args.district, page: 1, limit: 20 })).data,
    institution: async (_parent: unknown, args: { id: string }) => getInstitution(args.id)
  }
};

const apolloServer = new ApolloServer({ typeDefs, resolvers });
await apolloServer.start();
app.use("/graphql", expressMiddleware(apolloServer));

io.on("connection", (socket) => {
  socket.on("discussion:join", (discussionId: string) => socket.join(`discussion:${discussionId}`));
  socket.on("institution:join", (institutionId: string) => socket.join(`institution:${institutionId}`));
});

app.use((_request, response) => response.status(404).json({ message: "Route not found" }));

app.use((error: unknown, request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    response.status(413).json({ message: "File must be 5 MB or smaller" });
    return;
  }
  console.error(JSON.stringify({
    level: "error",
    event: "request.failed",
    requestId: response.getHeader("X-Request-Id"),
    method: request.method,
    path: request.path,
    message: error instanceof Error ? error.message : String(error),
    ...(config.isProduction ? {} : { stack: error instanceof Error ? error.stack : undefined })
  }));
  response.status(500).json({ message: config.demoMode ? "Request failed in demo mode" : "Internal server error" });
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", event: "server.started", service: "edupath-api", version: APP_VERSION, port, mode: config.demoMode ? "demo" : "production" }));
});

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "server.stopping", signal }));
  const forcedExit = setTimeout(() => {
    console.error(JSON.stringify({ level: "error", event: "server.shutdown-timeout" }));
    process.exit(1);
  }, config.shutdownTimeoutMs);
  forcedExit.unref();
  io.close();
  httpServer.close(async (error) => {
    await disconnectDataStore().catch((disconnectError) => console.error(disconnectError));
    clearTimeout(forcedExit);
    process.exit(error ? 1 : 0);
  });
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
