#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
PKG="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3"
REVIEW="${PKG}/program-production-gate-v6.3/official-source/program_official_source_review.csv"
OUT="${PKG}/program-ugc-authoritative-salvage-v6.3"
PASS="${OUT}/program_ugc_authoritative_salvage_pass.csv"
TOKEN="I_APPROVE_STRICT_VERIFIED_UGC_PROGRAM_DRAFT_IMPORT"

mkdir -p "${OUT}"

echo "=== 1/5 UGC AUTHORITATIVE PORTAL SALVAGE ==="
python3 "${API}/scripts/ugc_portal_program_salvage.py" "${REVIEW}" "${OUT}"

echo "=== 2/5 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 3/5 SAFETY TEST ==="
node --test tests/ops/ugc-authoritative-salvage-safety.test.mjs

echo "=== 4/5 GUARDED IMPORTER DRY RUN ==="
cd "${API}"
npx tsx scripts/import-ugc-programs-guarded.ts --file "${PASS}"

echo "=== 5/5 GUARDED DRAFT APPLY + POSTVERIFY ==="
if [[ ! -s "${PASS}" ]]; then
  echo "HARD_STOP: salvage pass file missing or empty"
  exit 2
fi

ROWS="$(($(wc -l < "${PASS}") - 1))"
if [[ "${ROWS}" -le 0 ]]; then
  echo "No new authoritative salvage rows. Nothing to import."
  exit 0
fi

npx tsx scripts/import-ugc-programs-guarded.ts \
  --file "${PASS}" \
  --apply \
  --approval-token "${TOKEN}"

npx tsx scripts/postverify-ugc-program-import.ts --file "${PASS}"

echo
echo "=== SALVAGE PIPELINE COMPLETE ==="
echo "Output: ${OUT}"
echo "Any unresolved rows remain quarantined in:"
echo "${OUT}/program_ugc_authoritative_unresolved.csv"
