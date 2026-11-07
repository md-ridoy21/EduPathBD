-- Read-only reporting views for SAP Crystal Reports or any PostgreSQL BI client.
-- Run after the Prisma schema has been applied.

CREATE OR REPLACE VIEW vw_edupath_overview AS
SELECT
  (SELECT COUNT(*) FROM "User") AS users,
  (SELECT COUNT(*) FROM "Institution") AS institutions,
  (SELECT COUNT(*) FROM "Program") AS programs,
  (SELECT COUNT(*) FROM "Circular") AS circulars,
  (SELECT COUNT(*) FROM "Application") AS applications,
  (SELECT COUNT(*) FROM "Comment") AS comments,
  (SELECT COUNT(*) FROM "AiInteraction") AS ai_interactions,
  (SELECT COUNT(*) FROM "ContentReport" WHERE status IN ('OPEN', 'REVIEWING')) AS open_reports,
  CURRENT_TIMESTAMP AS generated_at;

CREATE OR REPLACE VIEW vw_application_pipeline AS
SELECT status::text AS status, COUNT(*) AS total
FROM "Application"
GROUP BY status
ORDER BY total DESC;

CREATE OR REPLACE VIEW vw_institution_ratings AS
SELECT i.id AS institution_id, i.name AS institution_name,
       ROUND(AVG(r.score)::numeric, 2) AS average_rating,
       COUNT(r.id) AS rating_count
FROM "Institution" i
LEFT JOIN "Rating" r ON r."institutionId" = i.id
GROUP BY i.id, i.name
ORDER BY average_rating DESC NULLS LAST, rating_count DESC;

CREATE OR REPLACE VIEW vw_moderation_queue AS
SELECT cr.id, u.username AS reporter_username, cr."targetType" AS target_type,
       cr."targetId" AS target_id, cr.reason, cr.details,
       cr.status::text AS status, cr.resolution,
       cr."createdAt" AS created_at, cr."reviewedAt" AS reviewed_at
FROM "ContentReport" cr
JOIN "User" u ON u.id = cr."reporterId"
ORDER BY cr."createdAt" DESC;

CREATE OR REPLACE VIEW vw_ai_usage AS
SELECT feature, model, COUNT(*) AS interactions,
       MIN("createdAt") AS first_used_at, MAX("createdAt") AS last_used_at
FROM "AiInteraction"
GROUP BY feature, model
ORDER BY interactions DESC;

