import { spawn } from "node:child_process";
import process from "node:process";

const port = 4107;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["apps/api/dist/server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), DEMO_MODE: "true", WEB_ORIGINS: "http://localhost:5173,https://localhost,capacitor://localhost" },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
server.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const result = await request("/api/health");
      if (result.status === 200) return result;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`API did not start. ${stderr}`);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`✓ ${message}`);
}

try {
  const health = await waitForHealth();
  check(health.body.integrations.demoMode === true && health.body.integrations.databaseProvider === "demo-memory", "demo mode reports its integration status and database provider");
  check(health.body.status === "alive" && health.body.version === "1.1.0-rc.1", "release API reports a healthy v1.1.0 release candidate");
  const readiness = await request("/api/ready");
  check(readiness.status === 200 && readiness.body.status === "ready" && readiness.body.dataStore.provider === "demo-memory", "readiness endpoint verifies the active data store");

  const catalogStats = await request("/api/catalog/stats");
  check(catalogStats.status === 200 && catalogStats.body.institutions === 9 && catalogStats.body.programs === 17 && catalogStats.body.circulars === 4, "public catalog statistics report real verified records");

  const graphQlCatalog = await request("/graphql", { method: "POST", body: JSON.stringify({ query: "query { institutions(district: \"Chattogram\") { id name district verified } }" }) });
  check(graphQlCatalog.status === 200 && graphQlCatalog.body.data.institutions.length >= 2 && graphQlCatalog.body.data.institutions.every((item) => item.district === "Chattogram"), "Apollo GraphQL catalog query returns filtered institution data");

  const nativeCors = await request("/api/health", { headers: { Origin: "https://localhost" } });
  check(nativeCors.headers.get("access-control-allow-origin") === "https://localhost", "Capacitor native origin is explicitly allowed");
  const rejectedCors = await request("/api/health", { headers: { Origin: "https://untrusted.example" } });
  check(!rejectedCors.headers.get("access-control-allow-origin"), "unknown web origins receive no CORS permission");

  const availability = await request("/api/auth/username-availability?username=new_student");
  check(availability.status === 200 && availability.body.available === true, "username is checked against the application store");

  const studentLogin = await request("/api/auth/demo-login", { method: "POST", body: JSON.stringify({ username: "student_demo" }) });
  check(studentLogin.status === 200 && studentLogin.body.user.role === "STUDENT", "student session is issued");
  const studentToken = studentLogin.body.token;

  const emptyProfile = await request("/api/me/profile", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(emptyProfile.status === 200 && emptyProfile.body.data === null, "new student starts without a cloud profile");
  const profileInput = { level: "HSC", group: "Science", sscGpa: 4.75, hscGpa: 4.8, interest: "Engineering & Technology", location: "Chattogram" };
  const savedProfile = await request("/api/me/profile", { method: "PUT", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify(profileInput) });
  check(savedProfile.status === 200 && savedProfile.body.data.interest === profileInput.interest, "student profile is saved to the application store");
  const loadedProfile = await request("/api/me/profile", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(loadedProfile.status === 200 && loadedProfile.body.data.location === profileInput.location && loadedProfile.body.data.hscGpa === profileInput.hscGpa, "student profile survives a fresh API read");

  const filteredCatalog = await request("/api/institutions?type=POLYTECHNIC&limit=1&page=1");
  check(filteredCatalog.status === 200 && filteredCatalog.body.data.length === 1 && filteredCatalog.body.pagination.pages >= 2, "institution filters and server pagination work together");

  const programCatalog = await request("/api/programs?group=Science&limit=5");
  check(programCatalog.status === 200 && programCatalog.body.data.length === 5, "program catalog supports student-group filtering");
  const medicalPrograms = await request("/api/programs?type=MEDICAL&district=Chattogram&limit=10");
  check(medicalPrograms.status === 200 && medicalPrograms.body.data.length === 1 && medicalPrograms.body.data[0].institutionName === "Chattogram Medical College", "program results follow institution type and district filters");

  const circularCatalog = await request("/api/circulars?from=2026-09-01&to=2026-12-31&limit=8");
  check(circularCatalog.status === 200 && circularCatalog.body.data.length >= 4, "deadline date range returns admission circulars");

  const eligibility = await request("/api/eligibility/evaluate", { method: "POST", body: JSON.stringify({ level: "HSC", group: "SCIENCE", gpa: 4.8, sscGpa: 4.75, hscGpa: 4.8, interest: "Engineering & Technology" }) });
  const engineeringResult = eligibility.body.results?.find((item) => item.id === "engineering");
  check(eligibility.status === 200 && eligibility.body.engine === "database-admission-rules-v2" && eligibility.body.rulesEvaluated === 17, "eligibility endpoint evaluates the current admission-rule store");
  check(engineeringResult?.eligible === true && engineeringResult.matchingPrograms > 0 && engineeringResult.programs.every((item) => item.sourceUrl), "eligibility response returns sourced matching programs");

  const ineligibleMedical = await request("/api/eligibility/evaluate", { method: "POST", body: JSON.stringify({ level: "HSC", group: "HUMANITIES", gpa: 5, sscGpa: 5, hscGpa: 5, interest: "Medical & Health Sciences" }) });
  check(ineligibleMedical.body.results?.find((item) => item.id === "medical")?.eligible === false, "eligibility engine rejects a disallowed academic group");

  const scholarships = await request("/api/scholarships?level=HSC&group=Science&gpa=4.8&limit=12");
  check(scholarships.status === 200 && scholarships.body.data.length >= 3 && scholarships.body.data.every((item) => item.verified && item.sourceUrl), "scholarship matching returns verified and sourced opportunities");
  const technicalScholarships = await request("/api/scholarships?level=SSC&group=Vocational&gpa=3&limit=12");
  check(technicalScholarships.status === 200 && technicalScholarships.body.data.some((item) => item.id === "sch_polytechnic"), "scholarship matching supports SSC technical profiles");

  const institutionId = filteredCatalog.body.data[0].id;
  const saved = await request(`/api/me/shortlist/${institutionId}`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` } });
  check(saved.status === 201 && saved.body.saved === true, "student can shortlist an institution");
  const shortlist = await request("/api/me/shortlist", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(shortlist.status === 200 && shortlist.body.data.some((item) => item.id === institutionId), "student shortlist persists in the application store");

  const programId = programCatalog.body.data[0].id;
  const started = await request("/api/me/applications", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ programId }) });
  check(started.status === 201 && started.body.documents.length === 4, "application tracker creates its document checklist");
  const applicationId = started.body.id;
  const documentId = started.body.documents[0].id;
  const checked = await request(`/api/me/applications/${applicationId}/documents/${documentId}`, { method: "PATCH", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ completed: true }) });
  check(checked.status === 200 && checked.body.documents[0].isCompleted === true, "document checklist progress can be updated");
  const progressed = await request(`/api/me/applications/${applicationId}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ status: "DOCUMENTS_PENDING" }) });
  check(progressed.status === 200 && progressed.body.status === "DOCUMENTS_PENDING", "application status workflow can be advanced");

  const personalExport = await request("/api/me/export", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(personalExport.status === 200 && personalExport.body.user.username === "student_demo" && personalExport.body.profile.location === profileInput.location && personalExport.body.applications.some((item) => item.id === applicationId), "personal data export contains the signed-in student's workflow data");

  const discussion = await request("/api/institutions/inst_du/discussion", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(discussion.status === 200 && discussion.body.id, "institution discussion is loaded from the application store");
  const emptyDiscussion = await request("/api/institutions/inst_cu/discussion", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(emptyDiscussion.status === 200 && emptyDiscussion.body === null, "institution without a discussion returns an expected empty state");
  const postId = discussion.body.id;

  const streamController = new AbortController();
  const stream = await fetch(`${baseUrl}/api/realtime/discussion/${postId}`, { signal: streamController.signal });
  const firstEvent = await stream.body.getReader().read();
  check(stream.status === 200 && new TextDecoder().decode(firstEvent.value).includes("connected"), "server-sent real-time channel connects");
  streamController.abort();

  const posted = await request(`/api/discussions/${postId}/comments`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ body: "Is the latest source link available?" }) });
  check(posted.status === 201 && posted.body.author.username === "student_demo", "authenticated comment is stored");
  const reply = await request(`/api/discussions/${postId}/comments`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ body: "I found it beside the deadline card.", parentId: posted.body.id }) });
  check(reply.status === 201 && reply.body.parentId === posted.body.id, "nested reply is stored against its parent");
  const voted = await request(`/api/comments/${posted.body.id}/vote`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ type: "LIKE" }) });
  check(voted.status === 200 && voted.body.likes === 1 && voted.body.postId === postId, "one-account comment vote returns live totals");
  const rated = await request("/api/institutions/inst_du/rating", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ score: 4 }) });
  check(rated.status === 200 && rated.body.userScore === 4 && rated.body.count >= 4, "institution rating is stored and aggregated");

  const uploaded = await request("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ fileName: "requirements.pdf", mimeType: "application/pdf", institutionId: "inst_du", base64: Buffer.from("%PDF-1.4 EduPath demo").toString("base64") }) });
  check(uploaded.status === 201 && uploaded.body.mode === "demo" && uploaded.body.url.startsWith("data:application/pdf"), "validated media upload returns a displayable demo resource");
  const spoofedUpload = await request("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ fileName: "fake.pdf", mimeType: "application/pdf", base64: Buffer.from("not a real PDF").toString("base64") }) });
  check(spoofedUpload.status === 400 && spoofedUpload.body.message.includes("does not match"), "spoofed upload is rejected with a clear validation message");
  const unsupportedUpload = await request("/api/media/upload", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ fileName: "unsafe.exe", mimeType: "application/octet-stream", base64: "QUJDRA==" }) });
  check(unsupportedUpload.status === 400 && unsupportedUpload.body.message.includes("Only PDF"), "unsupported upload type receives a specific safe error");

  const aiAnswer = await request("/api/ai/ask", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ question: "What are the next admission deadlines and fees?" }) });
  check(aiAnswer.status === 200 && aiAnswer.body.mode === "demo" && aiAnswer.body.sources.length > 0, "source-aware AI assistant works without a paid API key");
  const circularSummary = await request("/api/ai/circulars/circ_du_26/summary", { method: "POST", headers: { Authorization: `Bearer ${studentToken}` } });
  check(circularSummary.status === 200 && circularSummary.body.sources[0].id === "circ_du_26", "AI circular summary remains tied to its official record");
  const reported = await request(`/api/comments/${posted.body.id}/report`, { method: "POST", headers: { Authorization: `Bearer ${studentToken}` }, body: JSON.stringify({ reason: "VERIFY_SOURCE", details: "Please verify this admission guidance." }) });
  check(reported.status === 201 && reported.body.status === "OPEN", "student can submit a comment report to the moderation queue");

  const denied = await request("/api/admin/stats", { headers: { Authorization: `Bearer ${studentToken}` } });
  check(denied.status === 403, "student is denied access to protected admin data");

  const adminLogin = await request("/api/auth/demo-login", { method: "POST", body: JSON.stringify({ username: "admin_demo" }) });
  check(adminLogin.status === 200 && adminLogin.body.user.role === "ADMIN", "admin session is issued");
  const adminToken = adminLogin.body.token;
  const adminProfile = await request("/api/me/profile", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(adminProfile.status === 403, "student profile endpoint rejects admin accounts");

  const emptyMedia = await request("/api/institutions/inst_du/media");
  check(emptyMedia.status === 200 && emptyMedia.body.data.length === 0, "students never receive unverified uploaded media");
  const mediaResource = await request("/api/admin/media", { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ institutionId: "inst_du", type: "YOUTUBE", title: "Official admission briefing", url: "https://youtu.be/abcdefghijk" }) });
  check(mediaResource.status === 201 && mediaResource.body.url === "https://www.youtube-nocookie.com/embed/abcdefghijk" && mediaResource.body.verified === false, "admin media submission normalizes YouTube privacy embed URLs and starts pending");
  const invalidAudio = await request("/api/admin/media", { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ institutionId: "inst_du", type: "AUDIO", title: "Invalid audio", url: "http://example.com/audio.mp3" }) });
  check(invalidAudio.status === 400 && invalidAudio.body.message.includes("HTTPS"), "admin media rejects insecure or non-direct audio URLs");
  const publishedMedia = await request(`/api/admin/content/media/${mediaResource.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "VERIFIED" }) });
  const visibleMedia = await request("/api/institutions/inst_du/media");
  check(publishedMedia.status === 200 && visibleMedia.body.data[0]?.id === mediaResource.body.id && visibleMedia.body.data[0]?.verified, "verified institution media becomes the preferred public resource");

  const globalVideo = await request("/api/admin/media", { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ type: "YOUTUBE", title: "Global admission planning guide", url: "https://youtu.be/lmnopqrstuv", languageCode: "en" }) });
  check(globalVideo.status === 201 && !globalVideo.body.institutionId && globalVideo.body.languageCode === "en", "admin can create a language-aware global media fallback");
  await request(`/api/admin/content/media/${globalVideo.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "VERIFIED" }) });
  const globalAudio = await request("/api/admin/media", { method: "POST", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ type: "AUDIO", title: "Bangla EduPath guide", url: "https://example.com/edupath-guide-bn.mp3", languageCode: "bn" }) });
  await request(`/api/admin/content/media/${globalAudio.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "VERIFIED" }) });
  const fallbackMedia = await request("/api/institutions/inst_buet/media");
  check(fallbackMedia.status === 200 && fallbackMedia.body.data.some((item) => item.id === globalVideo.body.id && item.languageCode === "en") && fallbackMedia.body.data.some((item) => item.id === globalAudio.body.id && item.languageCode === "bn"), "institutions without dedicated media receive verified global video and localized audio fallbacks");

  const stats = await request("/api/admin/stats", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(stats.status === 200 && stats.body.institutions >= 3 && stats.body.aiInteractions >= 2, "admin can read expanded dashboard statistics");

  const analytics = await request("/api/admin/analytics", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(analytics.status === 200 && analytics.body.activity.aiInteractions >= 2 && Array.isArray(analytics.body.topRatedInstitutions), "admin analytics aggregate AI, rating and workflow activity");
  const moderation = await request("/api/admin/moderation/reports", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(moderation.status === 200 && moderation.body.data.some((item) => item.id === reported.body.id), "admin moderation queue includes user reports");
  const resolvedReport = await request(`/api/admin/moderation/reports/${reported.body.id}`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "RESOLVED", resolution: "Verified during integration test." }) });
  check(resolvedReport.status === 200 && resolvedReport.body.status === "RESOLVED", "moderator decision updates report status");
  const reportDataset = await request("/api/admin/reporting/dataset", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(reportDataset.status === 200 && reportDataset.body.data.overview, "Crystal Reports-compatible JSON dataset is protected and generated");
  const csvResponse = await fetch(`${baseUrl}/api/admin/reporting/export.csv?kind=analytics`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const csv = await csvResponse.text();
  check(csvResponse.status === 200 && csv.includes("section,metric,value,count,generatedAt"), "Crystal Reports-compatible CSV export is downloadable");

  const created = await request("/api/admin/institutions", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "Phase Two Demo College", slug: "phase-two-demo-college", type: "COLLEGE", district: "Chattogram" })
  });
  check(created.status === 201 && created.body.verified === false, "admin can create an unverified institution draft");

  const bulkImported = await request("/api/admin/import/institutions", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ csv: "name,slug,type,district,websiteUrl,sourceUrl\nBulk Import College,bulk-import-college,COLLEGE,Rangpur,https://example.edu.bd,https://example.edu.bd/source\nBad Row,bad row,NOT_A_TYPE,Dhaka,," })
  });
  check(bulkImported.status === 207 && bulkImported.body.imported.length === 1 && bulkImported.body.errors[0].row === 3, "bulk CSV import saves valid rows as drafts and reports invalid rows");

  const edited = await request(`/api/admin/content/institution/${created.body.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ district: "Cumilla", sourceUrl: "https://example.edu/source" })
  });
  check(edited.status === 200 && edited.body.editable.district === "Cumilla" && edited.body.sourceUrl === "https://example.edu/source", "admin can edit academic content before verification");

  const adminProgram = await request("/api/admin/programs", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ institutionId: created.body.id, name: "Information Systems", slug: "information-systems", level: "Undergraduate", durationMonths: 48, careerOutcomes: ["Systems Analyst"] })
  });
  check(adminProgram.status === 201 && adminProgram.body.verified === false, "admin can create a program draft");

  const invalidTuition = await request("/api/admin/programs", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ institutionId: created.body.id, name: "Invalid Tuition", slug: "invalid-tuition", level: "Undergraduate", tuitionMin: 100000, tuitionMax: 50000 })
  });
  check(invalidTuition.status === 400, "admin program rejects an inverted tuition range");

  const adminCircular = await request("/api/admin/circulars", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ institutionId: created.body.id, title: "Phase Three Admission Circular", academicSession: "2026-27", applicationEndsAt: "2026-12-20", sourceUrl: "https://example.edu/admission" })
  });
  check(adminCircular.status === 201 && adminCircular.body.verified === false, "admin can create a sourced circular for verification");

  const invalidCircularDates = await request("/api/admin/circulars", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ institutionId: created.body.id, title: "Invalid Date Order", academicSession: "2026-27", applicationStartsAt: "2026-12-21", applicationEndsAt: "2026-12-20", sourceUrl: "https://example.edu/admission" })
  });
  check(invalidCircularDates.status === 400, "admin circular rejects an invalid application date order");

  const hiddenDraft = await request("/api/institutions?search=Phase%20Two%20Demo%20College");
  check(hiddenDraft.status === 200 && hiddenDraft.body.pagination.total === 0, "unverified institution drafts are hidden from students");
  const reviewQueue = await request("/api/admin/content", { headers: { Authorization: `Bearer ${adminToken}` } });
  check(reviewQueue.status === 200 && reviewQueue.body.data.some((item) => item.id === created.body.id && item.status === "DRAFT"), "admin review queue includes the institution draft");
  const publishedChild = await request(`/api/admin/content/program/${adminProgram.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "VERIFIED" }) });
  const hiddenVerifiedChild = await request("/api/programs?search=Information%20Systems");
  check(publishedChild.status === 200 && hiddenVerifiedChild.body.pagination.total === 0, "verified program remains hidden while its parent institution is unverified");
  const published = await request(`/api/admin/content/institution/${created.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "VERIFIED" }) });
  check(published.status === 200 && published.body.status === "VERIFIED", "admin can publish a reviewed institution");
  const visiblePublished = await request("/api/institutions?search=Phase%20Two%20Demo%20College");
  check(visiblePublished.status === 200 && visiblePublished.body.pagination.total === 1, "verified institution becomes visible to students");
  const visiblePublishedChild = await request("/api/programs?search=Information%20Systems");
  check(visiblePublishedChild.body.pagination.total === 1, "verified program becomes visible only after its parent is published");
  const outdated = await request(`/api/admin/content/institution/${created.body.id}/verification`, { method: "PATCH", headers: { Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ status: "OUTDATED" }) });
  const hiddenOutdated = await request("/api/institutions?search=Phase%20Two%20Demo%20College");
  const hiddenChildAfterRetire = await request("/api/programs?search=Information%20Systems");
  check(outdated.status === 200 && hiddenOutdated.body.pagination.total === 0 && hiddenChildAfterRetire.body.pagination.total === 0, "outdated institution and its child content leave the public catalog");

  const disposableLogin = await request("/api/auth/demo-login", { method: "POST", body: JSON.stringify({ username: "delete_demo" }) });
  check(disposableLogin.status === 200, "disposable student account is created for deletion acceptance");
  const disposableToken = disposableLogin.body.token;
  const rejectedDeletion = await request("/api/me/account", { method: "DELETE", headers: { Authorization: `Bearer ${disposableToken}` }, body: JSON.stringify({ confirmation: "wrong_username" }) });
  check(rejectedDeletion.status === 400, "account deletion rejects an incorrect typed confirmation");
  const deletedAccount = await request("/api/me/account", { method: "DELETE", headers: { Authorization: `Bearer ${disposableToken}` }, body: JSON.stringify({ confirmation: "delete_demo" }) });
  check(deletedAccount.status === 200 && deletedAccount.body.deleted === true, "student can delete a confirmed disposable account");
  const reusableUsername = await request("/api/auth/username-availability?username=delete_demo");
  check(reusableUsername.status === 200 && reusableUsername.body.available === true, "deleted account releases its username in the application store");
} finally {
  server.kill("SIGTERM");
}
