# Physical phone acceptance test

Device: Physical Android phone  Android version: ______  Date: 2026-09-12

API URL: http://192.168.0.105:4000  Tester: Student device test

Use **Pass**, **Fail** or **Not tested**. Record every failure in `docs/BUG_LOG.md` with reproduction steps.

| # | Test | Expected result | Status |
|---:|---|---|---|
| 1 | Fresh install and first launch | App opens without a blank screen or crash | Pass |
| 2 | Footer → Device check | No blocking failure; API shows v1.0.0-rc.2 | Retest |
| 3 | Bangla/English switch and restart | Selected language remains after restart | Pass |
| 4 | Student demo login/logout | Session UI changes correctly and logout clears it | Pass (login and session UI); logout pending |
| 5 | Institution search/filter/pagination | Results and page controls respond | Not tested |
| 6 | Compare and shortlist | Three-way comparison and saved shortlist work | Not tested |
| 7 | Track application | Status and document checklist persist | Not tested |
| 8 | Deadline datepicker/reminder | Date filtering and in-app reminder work | Not tested |
| 9 | On-device prediction | Result appears even after network is disabled | Not tested |
| 10 | Edu AI key-free mode | Labelled cited fallback answer appears | Not tested |
| 11 | Live comment/reply/like/dislike | Database result and live count update | Not tested |
| 12 | Institution rating/report | Rating changes and report reaches admin queue | Not tested |
| 13 | Audio/video/map | Dedicated media overrides global media; otherwise bundled admission video and Bangla/English audio or spoken fallback work | Not tested |
| 14 | Upload validation | Allowed file previews; invalid/large file is rejected | Not tested |
| 15 | Admin demo and reports | Analytics/moderation and CSV export work | Not tested |
| 15a | Admin media publishing | Add campus and global YouTube/audio resources, verify them, then confirm campus-first and language-aware selection | Not tested |
| 16 | Offline revisit | Shell and previously cached public catalogs load | Not tested |
| 17 | Back button, keyboard and rotation | No trapped modal, overflow or lost form state | Not tested |
| 18 | 360 px portrait layout | No horizontal clipping; touch targets remain usable | Not tested |

## Sign-off

Critical failures open: ______  Non-critical failures open: ______

Presentation build accepted: Yes / No

Signature: ______________________________
