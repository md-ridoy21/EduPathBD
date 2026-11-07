# Selective old-version comparison

Compared inputs: v0.9.2 Production Hardened, v0.9.4 Production Account Lifecycle and v0.9.5 Production Runtime. The comparison was feature-selective: an older file was merged only when it added a real capability without weakening the current v1 release-candidate controls.

| Source | Useful capability found | Decision in v1.0.0-rc.2 |
| --- | --- | --- |
| v0.9.2 | Production configuration and runtime-hardening direction | Current v1 strict configuration, readiness endpoints, migration job, least-privilege container and bundle splitting were stronger, so the current implementation was retained. |
| v0.9.4 | Stable Firebase UID, student cloud profile, Account & privacy, export, cache cleanup and self-service deletion | Merged. Deletion was strengthened with a fresh Firebase token, UID/email match and ten-minute recent-authentication requirement. |
| v0.9.5 | Audited first-admin bootstrap, server integration probe and deployed runtime probe | Merged and adapted to current `/api/health`, `/api/ready` and package-version contracts. |
| Current v1 milestone | Encrypted backup, checksum-verified restore dry run, retention, integrity tests and recovery runbook | Retained completely. Older Docker/runtime files were not allowed to replace or weaken this design. |

## Result

The final source is not a copy of the newest old archive. It is the stronger v1 production base plus the missing account lifecycle and operational verification capabilities, followed by new security hardening, API acceptance tests, responsive Account & privacy E2E coverage, documentation and version alignment.
