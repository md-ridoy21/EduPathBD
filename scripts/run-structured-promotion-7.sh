#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"
TOKEN="${2:-}"

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
OUT="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3/admission-scholarship-structured-promotion-7"
APPROVAL="I_APPROVE_7_PENDING_STRUCTURED_PROMOTIONS"

mkdir -p "${OUT}"

echo "=== 1/5 BUILD EXACT 7 FROM DB EVIDENCE ==="
cd "${API}"
npx tsx scripts/build-structured-promotion-7.ts \
  --out "${OUT}/structured-promotion-7.json"

echo "=== 2/5 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 3/5 SAFETY TEST ==="
node --test tests/ops/structured-promotion-7-safety.test.mjs

echo "=== 4/5 IMPORTER ==="
cd "${API}"
if [[ "${MODE}" == "--apply" ]]; then
  if [[ "${TOKEN}" != "${APPROVAL}" ]]; then
    echo "HARD_STOP: invalid approval token"
    exit 2
  fi
  npx tsx scripts/import-pending-structured-promotions-7.ts \
    --file "${OUT}/structured-promotion-7.json" \
    --apply \
    --approval-token "${APPROVAL}"
else
  npx tsx scripts/import-pending-structured-promotions-7.ts \
    --file "${OUT}/structured-promotion-7.json"
fi

echo "=== 5/5 POSTVERIFY ==="
if [[ "${MODE}" == "--apply" ]]; then
  npx tsx scripts/postverify-pending-structured-promotions-7.ts
else
  echo "Dry run only. Postverify skipped."
fi
