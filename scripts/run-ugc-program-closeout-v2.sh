#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
PKG="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3"
OUT="${PKG}/program-phase-closeout-v6.3-v2"

mkdir -p "${OUT}"

FILE29="${PKG}/program-production-gate-v6.3/official-source/program_official_verified_pass.csv"
FILE1179="${PKG}/program-institution-site-salvage-v6.3/program_institution_site_salvage_pass.csv"
ORIGINAL="${PKG}/program-draft-staging-v6.3/program_draft_ready.csv"
PARENT66="${PKG}/program-parent-policy-split-v6.3/program_policy_blocked.csv"
SEM104="${PKG}/program-semantic-final-v6.3/program_semantic_quarantine_104.csv"
STRICT141="${PKG}/program-production-gate-v6.3/semantic/program_strict_semantic_quarantine.csv"
UNRES89="${PKG}/program-institution-site-salvage-v6.3/program_institution_site_unresolved.csv"

echo "=== 1/3 DB CLOSEOUT V2 ==="
cd "${API}"
npx tsx scripts/postverify-ugc-program-closeout-v2.ts \
  --file-a "${FILE29}" \
  --file-b "${FILE1179}" \
  --out-dir "${OUT}"

echo "=== 2/3 1608-ROW RECONCILIATION ==="
python3 scripts/reconcile_ugc_program_phase_v2.py \
  "${ORIGINAL}" "${PARENT66}" "${SEM104}" "${STRICT141}" "${UNRES89}" "${OUT}"

echo "=== 3/3 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo
echo "=== UGC PROGRAM CLOSEOUT V2 COMPLETE ==="
echo "No DB writes performed."
echo "Output: ${OUT}"
