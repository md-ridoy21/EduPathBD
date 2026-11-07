from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "EduPath-BD-ERD.pdf"
W, H = landscape(A3)

NAVY = colors.HexColor("#071B2E")
TEAL = colors.HexColor("#0F766E")
CYAN = colors.HexColor("#0891B2")
VIOLET = colors.HexColor("#7C3AED")
ROSE = colors.HexColor("#E11D48")
AMBER = colors.HexColor("#D97706")
INK = colors.HexColor("#0F172A")
MUTED = colors.HexColor("#64748B")
LINE = colors.HexColor("#CBD5E1")
PAPER = colors.HexColor("#F8FAFC")

ENTITIES = {
    "User": ["PK id", "UK username", "UK email", "role", "emailVerifiedAt", "phoneVerifiedAt"],
    "StudentProfile": ["PK id", "FK/UK userId", "currentStage", "academicGroup", "sscGpa / hscGpa", "interests[]", "careerGoals[]"],
    "Institution": ["PK id", "UK slug", "type", "district", "verificationStatus", "sourceUrl", "latitude / longitude"],
    "Program": ["PK id", "FK institutionId", "UK institutionId + slug", "level", "tuitionMin / tuitionMax", "careerOutcomes[]", "verificationStatus"],
    "AdmissionRule": ["PK id", "FK programId", "UK programId + session", "allowedGroups[]", "minimum GPA fields", "subject rules (JSON)", "sourceUrl"],
    "Circular": ["PK id", "FK institutionId", "FK programId (nullable)", "academicSession", "applicationEndsAt", "applicationFee", "sourceUrl", "verificationStatus"],
    "Scholarship": ["PK id", "FK institutionId (nullable)", "FK programId (nullable)", "provider", "eligibility (JSON)", "deadline", "verificationStatus"],
    "Application": ["PK id", "FK userId", "FK programId", "UK userId + programId", "status", "referenceNo", "appliedAt"],
    "ApplicationDocument": ["PK id", "FK applicationId", "title", "fileUrl / storagePath", "isRequired", "isCompleted", "uploadedAt"],
    "DiscussionPost": ["PK id", "FK authorId", "FK institutionId (nullable)", "FK programId (nullable)", "FK circularId (nullable)", "title / body", "isLocked"],
    "Comment": ["PK id", "FK postId", "FK authorId", "FK parentId (self, nullable)", "body", "isVerified", "isHidden"],
    "CommentVote": ["PK id", "FK commentId", "FK userId", "UK commentId + userId", "type: LIKE / DISLIKE"],
    "Rating": ["PK id", "FK userId", "FK institutionId (nullable)", "FK programId (nullable)", "UK user + target", "score", "review"],
    "Media": ["PK id", "FK institutionId (nullable)", "FK programId (nullable)", "type", "title", "url"],
    "SavedItem": ["PK id", "FK userId", "UK user + itemType + itemId", "itemType", "itemId", "createdAt"],
    "Notification": ["PK id", "FK userId", "title / body", "type", "data (JSON)", "scheduledAt", "readAt"],
    "AiInteraction": ["PK id", "FK userId", "feature", "prompt / response", "model", "sourceIds[]", "safetyNotice"],
    "ContentReport": ["PK id", "FK reporterId", "UK reporter + target", "targetType / targetId", "reason", "status", "resolution", "reviewedAt"],
    "AuditLog": ["PK id", "FK adminUserId", "action", "entityType / entityId", "before / after (JSON)", "createdAt"],
}

RELATIONSHIPS = [
    ("User", "1 - 0..1", "StudentProfile", "StudentProfile.userId", "CASCADE"),
    ("Institution", "1 - many", "Program", "Program.institutionId", "CASCADE"),
    ("Program", "1 - many", "AdmissionRule", "AdmissionRule.programId", "CASCADE"),
    ("Institution", "1 - many", "Circular", "Circular.institutionId", "CASCADE"),
    ("Program", "1 - many", "Circular", "Circular.programId", "SET NULL"),
    ("Institution", "1 - many", "Scholarship", "Scholarship.institutionId", "SET NULL"),
    ("Program", "1 - many", "Scholarship", "Scholarship.programId", "SET NULL"),
    ("User", "1 - many", "Application", "Application.userId", "CASCADE"),
    ("Program", "1 - many", "Application", "Application.programId", "CASCADE"),
    ("Application", "1 - many", "ApplicationDocument", "ApplicationDocument.applicationId", "CASCADE"),
    ("User", "1 - many", "DiscussionPost", "DiscussionPost.authorId", "CASCADE"),
    ("Institution", "1 - many", "DiscussionPost", "DiscussionPost.institutionId", "CASCADE"),
    ("Program", "1 - many", "DiscussionPost", "DiscussionPost.programId", "CASCADE"),
    ("Circular", "1 - many", "DiscussionPost", "DiscussionPost.circularId", "CASCADE"),
    ("DiscussionPost", "1 - many", "Comment", "Comment.postId", "CASCADE"),
    ("User", "1 - many", "Comment", "Comment.authorId", "CASCADE"),
    ("Comment", "1 - many", "Comment", "Comment.parentId", "CASCADE"),
    ("Comment", "1 - many", "CommentVote", "CommentVote.commentId", "CASCADE"),
    ("User", "1 - many", "CommentVote", "CommentVote.userId", "CASCADE"),
    ("User", "1 - many", "Rating", "Rating.userId", "CASCADE"),
    ("Institution", "1 - many", "Rating", "Rating.institutionId", "CASCADE"),
    ("Program", "1 - many", "Rating", "Rating.programId", "CASCADE"),
    ("Institution", "1 - many", "Media", "Media.institutionId", "CASCADE"),
    ("Program", "1 - many", "Media", "Media.programId", "CASCADE"),
    ("User", "1 - many", "SavedItem", "SavedItem.userId", "CASCADE"),
    ("User", "1 - many", "Notification", "Notification.userId", "CASCADE"),
    ("User", "1 - many", "AiInteraction", "AiInteraction.userId", "CASCADE"),
    ("User", "1 - many", "ContentReport", "ContentReport.reporterId", "CASCADE"),
    ("User", "1 - many", "AuditLog", "AuditLog.adminUserId", "RESTRICT"),
]

def header(c, title, subtitle, page):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(NAVY); c.rect(0, H - 72, W, 72, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 22); c.drawString(42, H - 43, title)
    c.setFillColor(colors.HexColor("#A7F3D0")); c.setFont("Helvetica", 9); c.drawRightString(W - 42, H - 39, subtitle)
    c.setFillColor(MUTED); c.setFont("Helvetica", 8); c.drawString(42, 22, "EduPath BD  |  Prisma/PostgreSQL schema  |  Phase 5")
    c.drawRightString(W - 42, 22, f"Page {page}")

def rounded_box(c, x, y, w, h, title, lines, accent=TEAL, font_size=8.2):
    c.setFillColor(colors.white); c.setStrokeColor(LINE); c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 9, fill=1, stroke=1)
    c.setFillColor(accent); c.roundRect(x, y + h - 29, w, 29, 9, fill=1, stroke=0)
    c.rect(x, y + h - 29, w, 10, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 10.5); c.drawString(x + 11, y + h - 19, title)
    c.setFillColor(INK); c.setFont("Helvetica", font_size)
    line_y = y + h - 44
    for line in lines:
        c.drawString(x + 11, line_y, line)
        line_y -= font_size + 4.0

def domain_card(c, x, y, w, h, title, tables, accent):
    c.setFillColor(colors.white); c.setStrokeColor(accent); c.setLineWidth(1.2); c.roundRect(x, y, w, h, 12, fill=1, stroke=1)
    c.setFillColor(accent); c.roundRect(x, y + h - 38, w, 38, 12, fill=1, stroke=0); c.rect(x, y + h - 38, w, 12, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 12); c.drawString(x + 14, y + h - 24, title)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 9)
    yy = y + h - 57
    for table in tables:
        c.drawString(x + 15, yy, table); yy -= 18

def overview_page(c):
    header(c, "EduPath BD - Entity Relationship Diagram", "System domain map", 1)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(42, H - 102, "Relational architecture overview")
    c.setFillColor(MUTED); c.setFont("Helvetica", 9); c.drawString(42, H - 119, "Arrows indicate the main data flow; full cardinalities and foreign keys are listed on page 4.")
    cards = [
        (42, 520, 210, 180, "Identity", ["User", "StudentProfile", "Notification"], CYAN),
        (278, 520, 260, 180, "Verified catalog", ["Institution", "Program", "AdmissionRule", "Circular", "Scholarship", "Media"], TEAL),
        (564, 520, 230, 180, "Student workflow", ["Application", "ApplicationDocument", "SavedItem"], AMBER),
        (820, 520, 285, 180, "Community trust", ["DiscussionPost", "Comment", "CommentVote", "Rating", "ContentReport"], ROSE),
        (350, 250, 250, 150, "Intelligence", ["AiInteraction", "On-device model*"], VIOLET),
        (650, 250, 250, 150, "Operations", ["AuditLog", "Crystal datasets*"], NAVY),
    ]
    for item in cards: domain_card(c, *item)
    c.setStrokeColor(LINE); c.setLineWidth(2)
    for x1, y1, x2, y2 in [(252,610,278,610),(538,610,564,610),(794,610,820,610),(147,520,475,400),(680,520,475,400),(963,520,775,400),(600,325,650,325)]:
        c.line(x1,y1,x2,y2)
    c.setFillColor(colors.HexColor("#E2E8F0")); c.roundRect(42, 92, W - 84, 104, 12, fill=1, stroke=0)
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 10); c.drawString(58, 168, "Design guarantees")
    guarantees = ["One account per verified identity", "Official-source fields separated from user opinion", "One vote/rating per account", "Moderation and AI audit trail", "Cross-platform client; server-owned security"]
    c.setFont("Helvetica", 9)
    for index, text in enumerate(guarantees): c.drawString(58 + (index % 3) * 350, 145 - (index // 3) * 25, f"- {text}")
    c.setFillColor(MUTED); c.setFont("Helvetica-Oblique", 7.5); c.drawString(42, 56, "* Non-table runtime/reporting components are shown for system context and are not database entities.")

def detail_page(c, title, names, page):
    header(c, title, "Entity keys and important attributes", page)
    cols, rows = 4, 3
    gap_x, gap_y = 16, 18
    margin_x, top = 42, H - 98
    box_w = (W - margin_x * 2 - gap_x * (cols - 1)) / cols
    box_h = 205
    accents = [CYAN, TEAL, AMBER, ROSE, VIOLET, NAVY]
    for index, name in enumerate(names):
        col, row = index % cols, index // cols
        x = margin_x + col * (box_w + gap_x)
        y = top - (row + 1) * box_h - row * gap_y
        rounded_box(c, x, y, box_w, box_h, name, ENTITIES[name], accents[index % len(accents)])
    c.setFillColor(MUTED); c.setFont("Helvetica", 7.5)
    c.drawString(42, 48, "Legend: PK = primary key, FK = foreign key, UK = unique constraint. Nullable relationships are explicitly labelled.")

def relationships_page(c):
    header(c, "EduPath BD - Relationship Matrix", "Cardinalities, keys and delete behavior", 4)
    cols = [("Parent", 42, 150), ("Cardinality", 192, 100), ("Child", 292, 170), ("Foreign key", 462, 310), ("On delete", 772, 105)]
    top = H - 106
    c.setFillColor(NAVY); c.roundRect(42, top - 24, 835, 24, 6, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 8)
    for label, x, _ in cols: c.drawString(x + 6, top - 16, label)
    y = top - 42
    c.setFont("Helvetica", 7.3)
    for index, row in enumerate(RELATIONSHIPS):
        if index % 2 == 0:
            c.setFillColor(colors.HexColor("#EEF2F6")); c.rect(42, y - 3, 835, 17, fill=1, stroke=0)
        c.setFillColor(INK)
        values = [row[0], row[1], row[2], row[3], row[4]]
        for value, (_, x, width) in zip(values, cols):
            clipped = value if stringWidth(value, "Helvetica", 7.3) <= width - 10 else value[:42] + "..."
            c.drawString(x + 6, y + 2, clipped)
        y -= 20
    c.setFillColor(colors.white); c.setStrokeColor(LINE); c.roundRect(910, H - 285, 235, 179, 10, fill=1, stroke=1)
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(925, H - 132, "Polymorphic references")
    c.setFillColor(INK); c.setFont("Helvetica", 8)
    notes = ["SavedItem.itemId", "ContentReport.targetId", "AuditLog.entityId", "AiInteraction.sourceIds[]", "Notification.data (JSON)"]
    yy = H - 158
    for note in notes: c.drawString(925, yy, f"- {note}"); yy -= 23
    c.setFillColor(colors.HexColor("#FFF7ED")); c.roundRect(910, H - 480, 235, 165, 10, fill=1, stroke=0)
    c.setFillColor(AMBER); c.setFont("Helvetica-Bold", 11); c.drawString(925, H - 341, "Integrity rules")
    c.setFillColor(INK); c.setFont("Helvetica", 8)
    rules = ["Unique usernames and emails", "One application per program", "One vote per comment", "One rating per target", "One report per user/target", "Cascade ownership cleanup"]
    yy = H - 366
    for rule in rules: c.drawString(925, yy, f"- {rule}"); yy -= 21
    c.setFillColor(colors.HexColor("#ECFDF5")); c.roundRect(910, 108, 235, 156, 10, fill=1, stroke=0)
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(925, 237, "Source of truth")
    c.setFillColor(INK); c.setFont("Helvetica", 8)
    lines = ["Schema:", "apps/api/prisma/schema.prisma", "", "Generated:", "Phase 5 checkpoint", "", "Database: PostgreSQL"]
    yy = 213
    for line in lines: c.drawString(925, yy, line); yy -= 17

def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("EduPath BD Scalable ERD")
    c.setAuthor("EduPath BD")
    overview_page(c); c.showPage()
    detail_page(c, "EduPath BD - Identity and Catalog Entities", list(ENTITIES)[:10], 2); c.showPage()
    detail_page(c, "EduPath BD - Community, Workflow and AI Entities", list(ENTITIES)[10:], 3); c.showPage()
    relationships_page(c); c.showPage()
    c.save()
    print(OUTPUT)

if __name__ == "__main__":
    main()
