#!/usr/bin/env python3
"""Generate the complete EduPath BD feature and acceptance manual."""

from pathlib import Path
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, ListFlowable, ListItem
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "EduPath-BD-v1.0.0-rc.2-Feature-and-QA-Manual.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#071B2E")
INK = colors.HexColor("#162235")
MUTED = colors.HexColor("#56667A")
TEAL = colors.HexColor("#087F78")
MINT = colors.HexColor("#DDF8EE")
CYAN = colors.HexColor("#CFF5FA")
AMBER = colors.HexColor("#FFF3CF")
ROSE = colors.HexColor("#FFE4E8")
LINE = colors.HexColor("#D9E2EC")
PAPER = colors.HexColor("#F8FAFC")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=TEAL, spaceAfter=7, tracking=1.3))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=29, leading=33, textColor=NAVY, alignment=TA_LEFT, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=12, leading=18, textColor=MUTED, spaceAfter=7))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY, spaceBefore=4, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=TEAL, spaceBefore=8, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.7, leading=12.4, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.5, leading=10.4, textColor=MUTED))
styles.add(ParagraphStyle(name="Cell", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.2, leading=9.6, textColor=INK))
styles.add(ParagraphStyle(name="CellBold", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=7.2, leading=9.6, textColor=NAVY))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=8.3, leading=12, textColor=NAVY, leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=7))
styles.add(ParagraphStyle(name="CodeX", parent=styles["Code"], fontName="Courier", fontSize=7.2, leading=10, textColor=NAVY, leftIndent=8, rightIndent=8, spaceBefore=3, spaceAfter=6))


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def bullet_list(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=9) for item in items],
        bulletType="bullet", start="circle", leftIndent=15, bulletFontName="Helvetica",
        bulletFontSize=6, bulletColor=TEAL, spaceAfter=6
    )


def table(headers, rows, widths, header_color=NAVY, repeat=1):
    data = [[p(h, "CellBold") for h in headers]] + [[p(str(cell), "Cell") for cell in row] for row in rows]
    result = Table(data, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    result.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return result


def feature_table(rows):
    return table(
        ["Feature", "Expected behavior", "Manual acceptance check", "Failure signal"],
        rows, [32*mm, 55*mm, 53*mm, 38*mm]
    )


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, height - 16*mm, width, 16*mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(17*mm, height - 10.4*mm, "EduPath BD - Feature, Technology and Acceptance Manual")
    canvas.setStrokeColor(LINE)
    canvas.line(17*mm, 14*mm, width - 17*mm, 14*mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(17*mm, 9.5*mm, "Release candidate 1.0.0-rc.2")
    canvas.drawRightString(width - 17*mm, 9.5*mm, f"Page {doc.page}")
    canvas.restoreState()


doc = BaseDocTemplate(
    str(OUTPUT), pagesize=A4, rightMargin=16*mm, leftMargin=16*mm,
    topMargin=23*mm, bottomMargin=19*mm,
    title="EduPath BD v1.0.0-rc.2 Feature and QA Manual", author="OpenAI Codex"
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
doc.addPageTemplates(PageTemplate(id="manual", frames=frame, onPage=header_footer))

story = []

# Cover
story += [Spacer(1, 24*mm), p("EDUPATH BD", "CoverKicker"), p("Production Release Candidate", "CoverTitle"),
          p("Feature, technology and manual acceptance guide", "CoverTitle"), Spacer(1, 8*mm)]
cover_rows = [
    ("Version", "1.0.0-rc.2 / Android+iOS build 21"),
    ("Prepared", date.today().strftime("%d %B %Y")),
    ("Purpose", "Navigate the full app, compare expected behavior, capture defects and prepare real production evidence."),
    ("Scope", "Teacher requirements 1-24, professional additions, old-release merges, tools, security, recovery and launch gates."),
]
story += [table(["Release field", "Value"], cover_rows, [36*mm, 142*mm], header_color=TEAL), Spacer(1, 12*mm),
          p("This manual separates three things clearly: code that is implemented and tested, behavior that must be verified on the final laptop/phone, and external production evidence that cannot be proven without live accounts, infrastructure or Windows/macOS tooling.", "Callout"),
          Spacer(1, 28*mm), p("Use it as a pass/fail workbook. Do not mark a feature complete because the screen exists; confirm authorization, saved state, reload behavior, errors and the expected API result.", "CoverSub"), PageBreak()]

# Verdict
story += [p("1. Release verdict and evidence", "H1x")]
verdict = [
    ("Current baseline", "v1.0.0-rc.2 merges useful v0.9.2, v0.9.4 and v0.9.5 production features into the stronger v1 RC base.", "Source complete; external deployment evidence remains."),
    ("Automated QA", "TypeScript, 20 API/unit tests, 4 database-operations tests, TensorFlow verification, full API contract, release/production gates and build pass.", "Green in the review workspace."),
    ("API acceptance", "Profile persistence/export, account deletion, eligibility, scholarships, workflow, community, media, AI, admin, moderation and reporting are exercised.", "All verifier checks pass."),
    ("Browser E2E", "Desktop/mobile suite now opens responsive auth and Account & privacy controls.", "Run on laptop: review workspace could not obtain Chromium binary."),
    ("Production claim", "Strict startup, readiness, migrations, least privilege, encrypted backup/restore and integration probes are implemented.", "Still a release candidate until external gates have dated evidence."),
]
story += [table(["Area", "Verified result", "Honest boundary"], verdict, [34*mm, 92*mm, 52*mm]), Spacer(1, 7),
          p("Recommended manual order", "H2x"),
          bullet_list(["Health and responsive shell", "Public catalog and eligibility", "Student identity and saved workflow", "Community/media in two sessions", "Admin publishing and reports", "Offline/native behavior", "External production and recovery proof"]),
          p("Always capture route, role, exact steps, expected result, actual result, screenshot, console error and failed network request for every defect.", "Callout"), PageBreak()]

# Architecture and roles
story += [p("2. Roles and architecture", "H1x")]
roles = [
    ("Guest", "Public catalog, pathways, verified circulars/media, maps, PWA shell and diagnostics.", "Private student and all admin data."),
    ("Student", "Profile, eligibility, prediction, shortlist, comparison, applications, reminders, scholarships, comments, votes, ratings, reports, AI, export and self-deletion.", "Admin content, moderation and analytics."),
    ("Moderator", "Moderation queue and allowed review actions.", "Owner/admin operations outside assigned policy."),
    ("Admin", "Drafts, verification, media, CSV import, analytics, reporting, moderation and audited changes.", "Validation/source/audit bypass and self-service account deletion."),
]
story += [table(["Actor", "Allowed", "Must be denied"], roles, [30*mm, 88*mm, 60*mm]), Spacer(1, 8), p("System layers", "H2x")]
layers = [
    ("React + TypeScript + Vite", "Responsive UI, forms, localization, lazy feature modules and build."),
    ("Tailwind + Framer Motion", "Design system, accessible responsive layout and transitions."),
    ("Capacitor + PWA", "Android/iOS packaging, local notifications, safe areas, installability and offline shell."),
    ("Express 5 + Zod", "REST routing, request validation, authorization, rate limits and business workflows."),
    ("Apollo GraphQL", "Modern filtered institution query alongside REST endpoints."),
    ("PostgreSQL + Prisma", "Users, profiles, catalog, rules, applications, discussions, media, moderation and audit data."),
    ("Socket.IO + SSE", "Live discussion, vote and rating updates."),
    ("TensorFlow.js + Gemini", "On-device fit model plus source-aware generative guidance/fallback."),
    ("Docker + GitHub Actions + Playwright", "Repeatable migrations, hardened runtime, CI QA and browser acceptance."),
]
story += [table(["Layer", "Responsibility"], layers, [62*mm, 116*mm]), PageBreak()]

# Feature sections
story += [p("3. Product shell, accessibility and offline behavior", "H1x")]
story += [feature_table([
    ("Responsive navigation", "Desktop header, mobile menu, bottom navigation and footer reach every major section with no duplicate IDs or overflow.", "Check 360, 411, 768 and desktop widths; open/close menu; follow all links; browser Back.", "Hidden auth/menu, clipped content, wrong active state or dead anchor."),
    ("Bangla/English", "Visible labels and persistent locale change across reload and restart.", "Switch twice; reload; open auth, workspace, diagnostics and errors.", "Mixed labels, lost preference or untranslated validation."),
    ("Accessibility", "Skip link, single visible H1, named controls, focus, reduced motion and 40-44 px touch targets.", "Keyboard-only pass; inspect control names; enable reduced motion; run QA panel.", "Focus trap, icon without name, tiny target or motion ignoring preference."),
    ("PWA/offline", "Installable shell and cached public catalog after an online visit; private responses are never cached.", "Visit online, disconnect, reload, inspect caches and signed-in state.", "Blank shell, stale private data or false live status."),
    ("Diagnostics", "Health, API, navigation, storage, viewport and captured runtime/network errors can be exported.", "Run quality audit and Device check on laptop and phone; stop API and rerun.", "False green state, localhost in APK or secrets displayed."),
]), PageBreak()]

story += [p("4. Identity, sessions, profile and privacy", "H1x")]
story += [feature_table([
    ("Username reservation", "Debounced availability and registration use the same store; unique collision is rejected and failed Firebase registration rolls back.", "Try invalid/existing names and two-session collision.", "Name says available then is silently stolen, or orphan identity remains."),
    ("Email/phone verification", "Firebase verified email or phone creates an EduPath session; phone fictional-number mode is demo-only.", "Test email link, fictional number and real project separately.", "Unverified identity receives protected access or test bypass leaks to production."),
    ("JWT and roles", "Short-lived issuer/audience checked app JWT with server-side student/moderator/admin guards.", "Tamper token, wait expiry, call admin route as student and reload.", "UI-only protection, infinite expired-session loop or protected response."),
    ("Cloud profile sync", "Authenticated pathway profile hydrates after login and saves with loading/saving/synced/error state.", "Change GPA/group/location, wait for Synced, reload and sign in on second browser.", "Local value falsely labelled synced or older cloud state overwrites new input."),
    ("Personal export", "Only the signed-in user's profile, shortlist, applications and activity download as JSON; no Firebase UID/password/secret.", "Create state, export, inspect file and try another account.", "Cross-account data or credential material in export."),
    ("Account deletion", "Student types username; production also requires matching Firebase identity authenticated in last 10 minutes. Device state/reminders are cleared after success.", "Wrong confirmation; old sign-in; fresh sign-in; reload and check username availability.", "Admin deletion exposed, partial identity deletion or old session remains usable."),
    ("Sign out", "Firebase session, app JWT and protected UI are cleared.", "Sign out desktop/mobile; reload; revisit protected controls.", "Workspace remains mounted or previous token still works."),
]), PageBreak()]

story += [p("5. Discovery, eligibility and intelligence", "H1x")]
story += [feature_table([
    ("Institution/program catalog", "Verified records only; search, type/group/district filters and server pagination combine.", "Use each filter alone/together; page forward/back; open official source.", "Draft leak, count mismatch, filter reset or broken source."),
    ("Circular deadlines", "Verified sourced circulars follow date range, fee and ordering rules.", "Test valid/invalid ranges, boundaries and empty result.", "Timezone day error, inverted range accepted or source missing."),
    ("Eligibility engine", "Server evaluates current database admission rules by level, group and GPA and returns reasons plus sourced programs.", "Try eligible/ineligible Science, Humanities, Business and SSC technical profiles.", "Client-only formula, stale result or eligibility confused with prediction."),
    ("TensorFlow fit", "Bundled trained 5-8-1 model runs on-device/offline and ranks a strong compatible profile higher.", "Load once, disconnect, compare strong/weak inputs and repeat.", "Network dependency, random result or admission guarantee claim."),
    ("Why recommended", "Recommendation shows profile factors, reasons and disclaimer.", "Compare multiple pathways with different inputs.", "Only a score, no reasons, or certainty language."),
    ("Edu AI and summaries", "Authenticated source-aware answer cites records; Gemini, demo and safe fallback modes are labelled. Circular summary stays tied to its source.", "Ask a sourced question with/without key; inspect mode and citations.", "Uncited claim, hidden fallback, secret leak or summary of wrong circular."),
]), PageBreak()]

story += [p("6. Student planning and everyday workflow", "H1x")]
story += [feature_table([
    ("Three-way comparison", "Up to three institutions/programs persist locally and display exact comparable fields.", "Add/remove/reorder three; attempt fourth; reload.", "Duplicates, fourth item, stale or mismatched fields."),
    ("Shortlist", "Signed-in shortlist persists server-side and is isolated per account.", "Save/remove, reload, then inspect second student.", "Guest mutation or cross-account result."),
    ("Application tracker", "Program application creates valid status workflow and document checklist.", "Create, advance status, toggle documents, reload.", "Invalid jump, duplicate application or lost checklist."),
    ("Deadline reminders", "Browser/native reminder can schedule and cancel; denied permission degrades safely.", "Allow/deny, schedule near reminder, cancel and restart phone.", "False success, duplicate alert or crash on denial."),
    ("Scholarship matching", "Level/group/GPA query returns verified sourced opportunities and explains match.", "Test high/low GPA and SSC Vocational/HSC groups.", "Unverified result, missing source or same list for all profiles."),
    ("Parent progress PDF", "Student progress report downloads and shares using native sharing when available.", "Create workflow state, export PDF, inspect totals and share/cancel.", "Wrong student, missing state, unreadable PDF or share crash."),
    ("Career pathway", "Career outcome text and pathway cards connect interests, study options and fit reasons.", "Change interest, open pathways and verify result changes.", "Generic unchanged outcome or misleading job guarantee."),
]), PageBreak()]

story += [p("7. Community, media and map", "H1x")]
story += [feature_table([
    ("Comments/replies", "Authenticated database writes appear live; nested replies retain parent and author.", "Use two sessions; post comment/reply; reload both.", "Optimistic UI without persistence, wrong parent or private data leak."),
    ("Like/dislike", "One vote per user/comment, server totals and live update; changing vote reconciles totals.", "Vote from two users, switch type, reload.", "Double count, client-only count or user can vote repeatedly."),
    ("Institution rating", "One 1-5 rating per account with live average, count and distribution.", "Rate from two sessions, edit score, reload.", "Average drift, score outside range or self-duplication."),
    ("Reports/moderation", "Student reports enter protected moderation queue; decision and resolution are audited.", "Report comment, open admin queue, resolve, refresh student/admin.", "Student sees queue, report disappears or decision has no audit."),
    ("Campus media", "Verified institution media wins; otherwise language-aware global fallback, bundled admission video and device speech fallback.", "Select several campuses; toggle language; block network audio; inspect fallback.", "Old neural-network placeholder, empty panel or unverified media shown."),
    ("Map/location", "Leaflet/OpenStreetMap works without key; optional Google embed; location finds nearest listed campus.", "Allow/deny geolocation; choose campus; test map controls on phone.", "Permission crash, tiny controls, wrong campus or mandatory paid key."),
    ("Upload validation", "PDF/image/audio requires auth, size/MIME/base64/signature validation and safe preview/storage.", "Upload valid, spoofed, oversized and unsupported files.", "Generic error, executable accepted or unverified upload shown publicly."),
]), PageBreak()]

story += [p("8. Admin, reporting and content lifecycle", "H1x")]
story += [feature_table([
    ("Admin bootstrap", "One-time production command accepts only verified Firebase email, explicit confirmation, UID-safe linkage and audit log.", "Run without flag/demo mode/wrong email, then valid production staging run.", "Default admin password, role change without audit or conflicting UID overwrite."),
    ("Draft and verification", "Institution/program/circular/media drafts remain hidden until reviewed; child visibility follows parent state.", "Create draft, verify child first, verify parent, mark outdated.", "Draft leak, orphan verified child or missing source/reviewer."),
    ("Bulk CSV import", "Protected import parses quotes, reports row errors and saves valid rows as drafts.", "Import valid, quoted commas, duplicate slug and bad enum/date rows.", "Whole file silently fails or invalid rows publish."),
    ("Analytics", "Admin metrics aggregate applications, ratings, comments, reports and AI activity.", "Generate activity, refresh dashboard and compare counts.", "Client-estimated numbers, stale totals or student access."),
    ("Reporting", "Protected JSON/CSV plus XSD, PostgreSQL views and C# Crystal viewer scaffold support the final Windows report.", "Download data; open viewer assets; validate schema/sample.", "Public export, secret column or claim that missing .rpt is complete."),
    ("Audit trail", "Admin content edits, publication and moderation decisions record actor/action/entity and before/after data.", "Perform changes and inspect audit records in production DB/staging.", "Unattributed mutation or secrets in audit payload."),
]), PageBreak()]

# Requirements matrix
story += [p("9. Teacher requirements 1-24 traceability", "H1x")]
reqs = [
    (1, "Scalable PDF ERD", "Vector A3 ERD and relationship matrix", "Source complete"),
    (2, "Real-time own-DB comments", "PostgreSQL/memory comments, replies, SSE/Socket", "Live DB two-client proof"),
    (3, "Live like/dislike", "Unique per-user vote and server totals", "Live DB two-client proof"),
    (4, "Username check", "Debounce, reservation, unique constraint, rollback", "Live Firebase/DB proof"),
    (5, "Email and phone verification", "Firebase email and genuine phone OTP plus fictional demo", "Firebase project proof"),
    (6, "Inputs/dropdowns", "Student and protected admin forms", "Complete"),
    (7, "Real-time rating", "Per-account rating, live average/distribution", "Live DB proof"),
    (8, "Pagination", "Server pages and mobile controls", "Complete"),
    (9, "External audio/video", "Verified YouTube/audio and safe fallbacks", "Complete"),
    (10, "Maps/location", "Leaflet/OSM, geolocation, optional Google", "Device proof"),
    (11, "Session/JWT", "Firebase token then role-guarded app JWT", "Complete"),
    (12, "On-device prediction", "Committed TensorFlow.js 5-8-1 model", "Model verified"),
    (13, "Cloud upload/display", "Signature validation and Supabase adapter", "Live Supabase proof"),
    (14, "Datepicker", "Shared React Datepicker and date-order rules", "Complete"),
    (15, "Animation", "Framer Motion transitions", "Complete"),
    (16, "Styling", "Tailwind responsive system", "Complete"),
    (17, "Git/Vite", "Workspaces, Vite and one-command QA", "Hosted Git evidence"),
    (18, "GraphQL", "Apollo institution query", "Verified"),
    (19, "REST", "Express health/auth/catalog/workflow/admin APIs", "Verified"),
    (20, "Crystal Report", "JSON/CSV/XSD/views/C# viewer", "Final Windows .rpt pending"),
    (21, "Modern frontend", "React/TS/Capacitor Android+iOS+PWA", "iOS signing pending"),
    (22, "Docker/CI/CD", "Migrations, hardened runtime, Compose, Actions", "Hosted/runtime evidence"),
    (23, "Generative AI", "Gemini adapter, citations, audit, fallback", "Live Gemini key proof"),
    (24, "Additional features", "Localization, offline, accessibility, workflows, scholarship, PDF, CSV, admin", "Implemented; manual acceptance"),
]
story += [table(["#", "Requirement", "Implementation", "Final evidence"], reqs, [9*mm, 42*mm, 83*mm, 44*mm]), PageBreak()]

# Tech matrix
story += [p("10. Tools and technologies - what each one builds", "H1x")]
tech = [
    ("React 19", "Component UI", "Shell, modals, dashboards, forms and feature hubs."),
    ("TypeScript", "Static safety", "Shared contracts, safer refactors and CI type gate."),
    ("Vite/Rolldown", "Web build", "Fast development, production assets, proxies and explicit chunk groups."),
    ("Tailwind CSS", "Design system", "Responsive spacing, color, typography and touch targets."),
    ("Framer Motion", "Interaction", "Entrance/results/modal transitions with reduced-motion compatibility."),
    ("Capacitor", "Native bridge", "Android/iOS wrapper, safe areas and native plugin access."),
    ("Local Notifications", "Native reminders", "Deadline scheduling/cancellation on supported devices."),
    ("Service worker/PWA", "Offline delivery", "Installable shell and safe public API cache."),
    ("Express 5", "Backend API", "REST, middleware, errors, health/readiness and graceful shutdown."),
    ("Zod", "Validation", "Bounded request schemas and field-specific errors."),
    ("Apollo/GraphQL", "Modern query API", "Filtered institution query."),
    ("PostgreSQL", "System of record", "Accounts, catalog, workflow, community, audit and analytics."),
    ("Prisma", "Data access/migrations", "Typed queries, relationships, migration and seed workflows."),
    ("Firebase Auth/Admin", "Identity", "Email/phone verification, UID linkage and identity deletion."),
    ("Supabase Storage", "Cloud files", "Validated media storage and display adapter."),
    ("TensorFlow.js", "Local ML", "Offline pathway-fit inference with committed weights."),
    ("Gemini", "Generative AI", "Source-aware guidance and circular summary; fallback when unavailable."),
    ("Leaflet/OSM", "Maps", "Key-free campus map and device-location comparison."),
    ("Socket.IO/SSE", "Realtime", "Live community, vote and rating updates."),
    ("jsPDF/html2canvas", "Student reports", "Parent progress PDF generation and sharing."),
    ("React Datepicker", "Dates", "Deadline range and admin admission date inputs."),
    ("Docker/Compose", "Deployment", "PostgreSQL, migration, API and isolated recovery jobs."),
    ("GitHub Actions", "CI", "Generation, QA, E2E and critical audit gates."),
    ("Playwright", "Browser acceptance", "Desktop/mobile navigation, API and student-account smoke flows."),
    ("Crystal Reports/C#", "Formal reporting", "Windows viewer scaffold for the final proprietary .rpt layout."),
]
story += [table(["Technology", "Role", "Features built"], tech, [42*mm, 42*mm, 94*mm]), PageBreak()]

# Reliability / recovery
story += [p("11. Production runtime, recovery and security", "H1x")]
ops = [
    ("Strict production startup", "Fails closed without PostgreSQL, strong JWT secret, HTTPS origins, Firebase and Supabase credentials."),
    ("Health/readiness", "Liveness proves process; readiness proves data store; response includes request ID for tracing."),
    ("Migrations", "Separate deployment job runs Prisma migrations before API; production startup never seeds."),
    ("Least privilege", "Unprivileged, read-only container with dropped capabilities; database has no public port."),
    ("Encrypted backup", "pg_dump custom archive encrypted with AES-256/PBKDF2, SHA-256 manifest and bounded retention."),
    ("Safe restore", "Dry run by default; checksum/archive validation; exact DB confirmation plus explicit production approval."),
    ("Integrity checks", "Ranges, dates, sources, duplicate identities and verified media rules; strict mode promotes warnings."),
    ("Live integration check", "Production-only PostgreSQL, Firebase Admin and Supabase bucket probes without printing secrets."),
    ("Runtime check", "HTTPS liveness/readiness/version/CORS/catalog validation against deployed URL."),
]
story += [table(["Control", "Expected behavior"], ops, [52*mm, 126*mm]), Spacer(1, 7),
          p("Core commands", "H2x"),
          p("npm run qa<br/>npm run test:e2e<br/>npm run audit:critical<br/>npm run production:integrations-check<br/>npm run production:runtime-check -- --api-url https://api.example.com --origin https://app.example.com<br/>npm run db:backup<br/>npm run db:restore -- --file FILE.dump.enc<br/>npm run db:integrity -- --strict", "CodeX"),
          p("Never test a production restore on the only database. Restore into a separate drill database, run strict integrity checks and record recovery time and data loss.", "Callout"), PageBreak()]

# External gates
story += [p("12. Remaining external evidence before general availability", "H1x")]
gates = [
    ("PostgreSQL", "Migrate non-demo DB and run full integration workflow", "Deployment owner + dated QA log"),
    ("Catalog", "Load current official institutions/programs/circulars/scholarships with sources and review dates", "Content owner approval"),
    ("Firebase", "Authorized domains, email/phone flows and recent-auth deletion", "Physical-phone/video evidence"),
    ("Supabase", "Private bucket policy plus upload/read tests", "Integration check and manual upload"),
    ("Gemini", "Live key, quota, citations and fallback", "Response evidence without key exposure"),
    ("Domain/TLS", "Public HTTPS frontend/API and reverse proxy", "Runtime checker output"),
    ("Android", "Release keystore backup, signed AAB and physical-device sheet", "Store-ready artifact"),
    ("iOS", "Xcode signing/archive and physical-device pass", "macOS/Xcode evidence"),
    ("CI", "Hosted final commit with green QA/E2E/audit", "GitHub Actions link/screenshot"),
    ("Recovery", "Scheduled off-site encrypted backup and separate-DB restore drill", "Manifest and drill report"),
    ("Monitoring", "Availability, latency and error alerts", "Hosting dashboard evidence"),
    ("Privacy/legal", "Privacy policy, terms, retention/export/deletion approval", "Product-owner sign-off"),
    ("Crystal Reports", "Design and open final .rpt in SAP extension on Windows", "Screenshot and included file"),
]
story += [table(["Gate", "Exit test", "Evidence"], gates, [35*mm, 94*mm, 49*mm]), Spacer(1, 8),
          p("Until every row has an owner, date and evidence, call the project a production release candidate - not a generally available public service.", "Callout"), PageBreak()]

# Master manual run
story += [p("13. Final manual acceptance run", "H1x")]
manual = [
    (1, "Fresh install/open", "No blank screen; health and version rc.2 are correct"),
    (2, "Responsive + language", "No overflow; all nav/auth/account controls; locale persists"),
    (3, "Student identity", "Registration/login/verification/session expiry/signout correct"),
    (4, "Profile + privacy", "Cloud sync, export, cache clear and recent-auth deletion correct"),
    (5, "Catalog", "Search/filter/pagination/source links correct"),
    (6, "Eligibility + ML", "Rules explain eligibility; offline model is deterministic"),
    (7, "Compare/shortlist", "Limits, persistence and account isolation correct"),
    (8, "Applications", "Statuses/checklist/reminders survive reload"),
    (9, "Scholarship + parent PDF", "Matches are sourced; PDF/share content is accurate"),
    (10, "Community", "Two-session comments/replies/votes/ratings update live"),
    (11, "Media/map/upload", "Verified fallback precedence, location denial and upload errors correct"),
    (12, "AI", "Mode and citations are visible; failure falls back safely"),
    (13, "Admin", "Draft/publish/outdated hierarchy, CSV errors and audit behavior correct"),
    (14, "Reports", "Analytics, moderation, JSON/CSV and Crystal inputs correct"),
    (15, "Offline/native", "Public shell/cache, notifications, safe area, Back and rotation correct"),
    (16, "Production ops", "Integration/runtime checks, backup, dry-run restore and integrity evidence captured"),
]
story += [table(["#", "Test area", "Pass condition"], manual, [10*mm, 48*mm, 120*mm]), Spacer(1, 7),
          p("Laptop commands", "H2x"), p("npm ci<br/>npx playwright install chromium<br/>npm run qa<br/>npm run test:e2e<br/>npm run audit:critical", "CodeX"),
          p("Phone build (replace the IP with the current Wi-Fi address)", "H2x"), p("CAPACITOR_ALLOW_MIXED_CONTENT=true npm run android:debug -- --api-url http://192.168.x.x:4000 --install", "CodeX"), PageBreak()]

# defect template and delta
story += [p("14. Defect capture and old-version merge record", "H1x"), p("Defect record template", "H2x")]
defect = [
    ("ID/severity", "Example: RC2-MOB-001 / Blocker, High, Medium, Low"),
    ("Environment", "Version, browser/device, viewport, network, API mode"),
    ("Role/state", "Guest/student/admin; fresh/reloaded/offline"),
    ("Steps", "Small numbered reproduction with exact input"),
    ("Expected vs actual", "One measurable sentence each"),
    ("Evidence", "Screenshot/video, Console text, request URL/status, QA JSON"),
    ("Regression", "Whether v0.9.2/v0.9.4/v0.9.5 behaved differently"),
]
story += [table(["Field", "Record"], defect, [40*mm, 138*mm]), Spacer(1, 8), p("Selective merge result", "H2x")]
delta = [
    ("v0.9.2", "Production hardening concepts", "Current v1 strict configuration, readiness, containers and code splitting were stronger and retained."),
    ("v0.9.4", "Firebase UID, profile/privacy and account lifecycle", "Merged, then strengthened with recent Firebase authentication and identity-match deletion checks."),
    ("v0.9.5", "Admin bootstrap and live integration/runtime probes", "Merged and adapted to current health/readiness/version contracts."),
    ("Current v1 recovery", "Encrypted backup, restore dry run, retention, integrity and recovery docs", "Retained; old runtime files were not allowed to weaken it."),
]
story += [table(["Source", "Useful capability", "Final decision"], delta, [27*mm, 60*mm, 91*mm]), Spacer(1, 8),
          p("Release handoff", "H2x"), bullet_list([
              "Keep the rc.2 source archive, checksum, release notes and this manual together.",
              "Run E2E on the laptop after installing Playwright Chromium and attach the HTML report.",
              "Use the in-app QA JSON plus this manual to report every manual discrepancy.",
              "Do not delete the final source archive until it has been copied to two separate storage locations."
          ]), p("End of manual", "Callout")]

doc.build(story)
print(OUTPUT)
