#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/Downloads/EduPath-BD-v1.1.0-rc.1"
API="${ROOT}/apps/api"
OUT="${HOME}/Downloads/EduPath-UGC-Final-Assistant-Review-v6.3/admission-scholarship-reconstruction-audit-256"

mkdir -p "${OUT}"

echo "=== 1/3 TYPECHECK ==="
cd "${ROOT}"
npm run typecheck

echo "=== 2/3 READ-ONLY 256-GROUP AUDIT ==="
cd "${API}"
npx tsx scripts/reconstruction-audit-256.ts --out "${OUT}"

echo "=== 3/3 COMPLETE ==="
echo "No database writes performed."
echo "Output: ${OUT}"
