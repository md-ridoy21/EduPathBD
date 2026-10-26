#!/usr/bin/env bash
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
export EDUPATH_PHASE2_OUTPUT="${EDUPATH_PHASE2_OUTPUT:-$HOME/Downloads/EduPath-Admission-Intelligence-20260923}"
mkdir -p "$EDUPATH_PHASE2_OUTPUT"
echo "Output: $EDUPATH_PHASE2_OUTPUT"
python3 "$HERE/collect_phase2_central.py" || echo "Central collector returned non-zero; evidence preserved."
python3 "$HERE/collect_ugc_university_discovery.py" || echo "UGC discovery returned non-zero; evidence preserved."
python3 "$HERE/extract_text_and_fact_candidates.py" || echo "Text/fact extraction returned non-zero; install poppler-utils if pdftotext is missing."
python3 "$HERE/validate_phase2.py"
