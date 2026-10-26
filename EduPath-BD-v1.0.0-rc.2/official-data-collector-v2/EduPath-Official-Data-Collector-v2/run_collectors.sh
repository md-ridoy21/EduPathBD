#!/usr/bin/env bash
set -u
DATA_DIR="${DATA_DIR:-$HOME/Downloads/EduPath-Official-Data-2026-Reviewed-20260923}"
export DATA_DIR
mkdir -p "$DATA_DIR"/{03-bteb,04-ugc,06-bnmc,07-nu}

echo "Output: $DATA_DIR"
for script in collect_bnmc_latest.mjs collect_nu_full.mjs collect_bteb_2026_27.mjs collect_ugc_programs.mjs; do
  echo
  echo "===== $script ====="
  node "$script" || echo "Collector returned non-zero: $script (see diagnostics; continuing)"
done

echo
echo "===== validation ====="
node validate_collected_data.mjs || true
