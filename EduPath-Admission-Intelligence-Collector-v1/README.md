# EduPath Admission Intelligence Collector v1

Purpose: Phase 2 collection for **program/subject, current admission circulars, eligibility/GPA/group rules, fees/deadlines/seats, and scholarships** after institution-master reconciliation.

## Safety / truthfulness rules

- Raw discovery does **not** equal VERIFIED production data.
- Every structured rule must retain its official source URL, session/period, retrieved date, and review state.
- Historical notices stay historical; the collector must not present an expired deadline as open/current.
- DGME: as of the source research date (2026-09-23), the latest public MBBS/BDS national circular found is for 2025-26. Do not invent a 2026-27 circular.
- NU 2025-26 undergraduate notices and BTEB 2026-27 admission portal are collected as different sessions because that is what their official sources currently expose.
- TLS validation is bypassed in the collector because several Bangladesh government sites in this project have served certificate-chain/name errors. Output is still accepted only from the hard-coded official domains and is marked for source review.
- PDF snippets are **fact candidates**, not final normalized eligibility/deadline/fee rows.

## Run

```bash
cd ~/Downloads/EduPath-Admission-Intelligence-Collector-v1
chmod +x run_phase2.sh
./run_phase2.sh
```

No pip package is required. Python standard library is enough. If `pdftotext` is missing and you want PDF text/fact candidates:

```bash
sudo apt update
sudo apt install -y poppler-utils
./run_phase2.sh
```

Default output:

```text
~/Downloads/EduPath-Admission-Intelligence-20260923/
```

Key outputs:

- `central_notice_candidates.csv`
- `central_attachment_manifest.csv`
- `central_fetch_report.json`
- `ugc_university_discovery.csv`
- `attachment-text/`
- `fact_candidates.csv`
- `raw-central/` and `raw-ugc-sites/` provenance snapshots

## What this first Phase-2 collector intentionally does not do

It does not auto-promote a GPA, fee, seat, deadline, program, or scholarship into production. Attachment text is messy and session-sensitive. The next normalization step should convert only evidence-supported snippets into typed records such as `AdmissionRule`, `Circular`, `Program`, `SeatSnapshot`, and `Scholarship`, using PENDING -> VERIFIED review states.
