#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
PKG="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3"
INPUT="${PKG}/program-production-gate-v6.3/official-source/program_official_source_review.csv"
OUT="${PKG}/program-institution-site-salvage-v6.3"
PASS="${OUT}/program_institution_site_salvage_pass.csv"
TOKEN="I_APPROVE_STRICT_VERIFIED_UGC_PROGRAM_DRAFT_IMPORT"

mkdir -p "${OUT}"

echo "=== 1/5 INSTITUTION-SITE EVIDENCE SALVAGE ==="
cd "${API}"
npx tsx scripts/salvage-ugc-programs-from-institution-sites.ts \
  --file "${INPUT}" \
  --out-dir "${OUT}"

echo "=== 2/5 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 3/5 SAFETY TEST ==="
node --test tests/ops/ugc-institution-site-salvage-safety.test.mjs

ROWS="$(($(wc -l < "${PASS}") - 1))"
echo "salvage_pass_rows=${ROWS}"

if [[ "${ROWS}" -le 0 ]]; then
  echo "No strong-evidence salvage rows. No DB write performed."
  exit 0
fi

echo "=== 4/5 GUARDED IMPORTER DRY RUN ==="
cd "${API}"
npx tsx scripts/import-ugc-programs-guarded.ts --file "${PASS}"

echo "=== 5/5 GUARDED DRAFT APPLY ==="
npx tsx scripts/import-ugc-programs-guarded.ts \
  --file "${PASS}" \
  --apply \
  --approval-token "${TOKEN}"

echo
echo "=== INSTITUTION-SITE SALVAGE COMPLETE ==="
echo "Output: ${OUT}"
