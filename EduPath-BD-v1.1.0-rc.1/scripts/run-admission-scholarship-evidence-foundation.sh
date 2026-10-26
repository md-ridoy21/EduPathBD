#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"
TOKEN="${2:-}"

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
PKG="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3"
MASTER="${PKG}/final_approve_recommendations_v6_2.csv"
OUT="${PKG}/admission-scholarship-evidence-foundation-v1"
APPROVAL="I_APPROVE_1336_PENDING_SOURCE_EVIDENCE_IMPORT"

mkdir -p "${OUT}"

echo "=== 1/7 PATCH SCHEMA + CREATE MIGRATION ==="
python3 "${API}/scripts/patch_admission_scholarship_schema.py" "${API}"

echo "=== 2/7 PRISMA FORMAT / VALIDATE / GENERATE ==="
cd "${API}"
npx prisma format
npx prisma validate
npx prisma generate

echo "=== 3/7 BUILD 1336-ROW EVIDENCE STAGING ==="
python3 scripts/build_admission_scholarship_evidence_staging.py "${MASTER}" "${OUT}"

echo "=== 4/7 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 5/7 SAFETY TEST ==="
node --test tests/ops/admission-scholarship-evidence-foundation-safety.test.mjs

if [[ "${MODE}" != "--apply" ]]; then
  echo "=== 6/7 IMPORTER DRY RUN ==="
  cd "${API}"
  npx tsx scripts/import-source-evidence-guarded.ts \
    --file "${OUT}/source_evidence_1336.csv"
  echo "=== 7/7 NO APPLY REQUESTED ==="
  echo "Dry run complete. No DB writes performed."
  exit 0
fi

if [[ "${TOKEN}" != "${APPROVAL}" ]]; then
  echo "HARD_STOP: invalid approval token"
  exit 2
fi

echo "=== 6/7 MIGRATE DEPLOY + GUARDED IMPORT ==="
cd "${API}"
npx prisma migrate deploy
npx prisma generate

npx tsx scripts/import-source-evidence-guarded.ts \
  --file "${OUT}/source_evidence_1336.csv" \
  --apply \
  --approval-token "${APPROVAL}"

echo "=== 7/7 POST-IMPORT VERIFY ==="
npx tsx scripts/postverify-admission-scholarship-evidence.ts

echo
echo "=== FOUNDATION COMPLETE ==="
echo "Output: ${OUT}"
