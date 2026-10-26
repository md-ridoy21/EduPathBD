# EduPath Admission Intelligence — Phase-2 Repair v2

Purpose:
1. Inventory all downloaded Phase-2 attachments with SHA-256.
2. Flag executable / non-data downloads without deleting raw evidence.
3. Identify exact duplicate attachment groups.
4. Repair the missing BTEB 2026–27 source coverage from current official BTEB pages.
5. Build a compact review bundle so the next normalization pass does not require uploading hundreds of PDFs.

Run:

```bash
cd ~/Downloads/EduPath-Admission-Intelligence-Phase2-Repair-v2
chmod +x run_repair_v2.sh
./run_repair_v2.sh
```

Default input folder:

`~/Downloads/EduPath-Admission-Intelligence-20260923`

Override if needed:

```bash
EDUPATH_PHASE2_DIR=/path/to/your/output ./run_repair_v2.sh
```

Requirements:
- `python3`
- `curl`
- `pdftotext` (optional but strongly recommended)

Ubuntu install if needed:

```bash
sudo apt update
sudo apt install -y curl poppler-utils
```

The script never deletes or overwrites your existing raw evidence. It writes only under:

`EduPath-Admission-Intelligence-20260923/repair-v2/`
