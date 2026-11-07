#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"
TOKEN="${2:-}"

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
PKG="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3"
INPUT="${PKG}/program-semantic-final-v6.3/program_direct_clean_1438.csv"
OUT="${PKG}/program-production-gate-v6.3"

mkdir -p "${OUT}/semantic" "${OUT}/official-source"

echo "=== 1/5 STRICT SEMANTIC GATE ==="
python3 "${API}/scripts/strict_program_semantic_gate.py" \
  "${INPUT}" \
  "${OUT}/semantic"

echo "=== 2/5 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 3/5 OFFICIAL SOURCE VERIFICATION ==="
cd "${API}"
npx tsx scripts/verify-ugc-program-official-sources.ts \
  --file "${OUT}/semantic/program_strict_semantic_pass.csv" \
  --out-dir "${OUT}/official-source"

echo "=== 4/5 IMPORTER SAFETY TEST ==="
cd "${ROOT}"
node --test tests/ops/ugc-program-importer-safety.test.mjs

echo "=== 5/5 GUARDED IMPORTER ==="
cd "${API}"

PASS_FILE="${OUT}/official-source/program_official_verified_pass.csv"

if [[ "${MODE}" == "--apply" ]]; then
  if [[ "${TOKEN}" != "I_APPROVE_STRICT_VERIFIED_UGC_PROGRAM_DRAFT_IMPORT" ]]; then
    echo "HARD_STOP: invalid explicit approval token"
    exit 2
  fi

  npx tsx scripts/import-ugc-programs-guarded.ts \
    --file "${PASS_FILE}" \
    --apply \
    --approval-token "${TOKEN}"
else
  npx tsx scripts/import-ugc-programs-guarded.ts \
    --file "${PASS_FILE}"
fi

echo
echo "=== PIPELINE COMPLETE ==="
echo "Mode: ${MODE}"
echo "Output: ${OUT}"
