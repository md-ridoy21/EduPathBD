#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-$HOME/Downloads/EduPath-BD-v1.1.0-rc.1}"
HERE="$(cd "$(dirname "$0")" && pwd)"
if [[ ! -f "$TARGET/package.json" || ! -f "$TARGET/apps/api/prisma/schema.prisma" ]]; then
  echo "ERROR: EduPath project not found at: $TARGET" >&2
  echo "Usage: bash APPLY_FIX.sh /path/to/EduPath-BD-v1.1.0-rc.1" >&2
  exit 1
fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$TARGET/.full-safety-fix-backup-$STAMP"
mkdir -p "$BACKUP"
FILES=(
  apps/api/prisma/schema.prisma
  apps/api/prisma/seed.ts
  apps/api/scripts/import-official-catalog.ts
  apps/api/src/data/store.ts
  apps/api/src/server.ts
  apps/web/src/components/AdminContentForms.tsx
  apps/web/src/components/AdminReviewQueue.tsx
)
for f in "${FILES[@]}"; do
  if [[ -f "$TARGET/$f" ]]; then mkdir -p "$BACKUP/$(dirname "$f")"; cp -a "$TARGET/$f" "$BACKUP/$f"; fi
done
for f in "${FILES[@]}"; do mkdir -p "$TARGET/$(dirname "$f")"; cp -a "$HERE/$f" "$TARGET/$f"; done
mkdir -p "$TARGET/apps/api/prisma/migrations/20260924091500_admission_rule_verification"
cp -a "$HERE/apps/api/prisma/migrations/20260924091500_admission_rule_verification/migration.sql" "$TARGET/apps/api/prisma/migrations/20260924091500_admission_rule_verification/migration.sql"
mkdir -p "$TARGET/tests/ops"
cp -a "$HERE/tests/ops/content-publication-safety.test.mjs" "$TARGET/tests/ops/content-publication-safety.test.mjs"
echo "Applied full safety fix. Backup: $BACKUP"
echo "Your .env files, node_modules and database were NOT overwritten."
echo
echo "Now run:"
echo "  cd '$TARGET'"
echo "  npm run db:generate"
echo "  npm run typecheck"
echo "  npm run test:ops"
echo "  npm run qa"
echo
echo "After QA passes and after taking a DB backup, deploy schema migration with:"
echo "  npm run db:migrate:deploy"
echo "Do NOT use --publish-verified for catalog imports until content is production-verified."
