#!/usr/bin/env bash
set -u
DATA_DIR="${DATA_DIR:-$HOME/Downloads/EduPath-Official-Data-2026-Reviewed-20260923}"
export DATA_DIR
mkdir -p "$DATA_DIR"/{03-bteb,04-ugc,06-bnmc,07-nu}
echo "Output: $DATA_DIR"
for script in collect_bnmc_v4.mjs collect_bteb_master_v4.mjs collect_bteb_admission_v4.mjs collect_ugc_faculties_v4.mjs audit_nu_v4.mjs; do
  echo
  echo "===== $script ====="
  node "$script" || echo "Collector returned non-zero: $script (evidence preserved; continuing)"
done
echo
echo "===== validation v4 ====="
node validate_collected_data_v4.mjs || true
