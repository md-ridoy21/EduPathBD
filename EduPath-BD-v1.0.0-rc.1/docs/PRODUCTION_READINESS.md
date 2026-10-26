# Production readiness register

## Automated evidence in this repository

- TypeScript type checking and API/unit tests
- TensorFlow.js model artifact verification
- Full demo-store API contract verification
- Static release and production-hardening verification
- Desktop and mobile Playwright acceptance suite
- Production frontend build
- Strict production configuration validation
- Database readiness endpoint and graceful API shutdown
- Explicit PostgreSQL migration stage; no automatic production seeding
- Unprivileged, read-only API runtime container
- Same-origin web API default and explicit native API injection

## Evidence required before public launch

| Gate | Required evidence | Status in source archive |
| --- | --- | --- |
| PostgreSQL | Run migrations and integration flows against a non-demo database | External verification required |
| Catalog | Current official institution, program, circular and scholarship records with source URLs and review dates | Demo-scale starter catalog only |
| Firebase | Authorized domains, production project, identity and phone flows tested | Credentials not bundled |
| Supabase Storage | Private bucket policies and upload/download tests | Credentials not bundled |
| Gemini | Live key, quota and fallback behavior tested | Optional key not bundled |
| Domain/TLS | Public HTTPS frontend and API/reverse proxy | External deployment required |
| Android | Signed AAB, release keystore backup and physical-device acceptance | Debug workflow only |
| iOS | Signing, archive and physical-device acceptance on macOS | Source project only |
| CI | Hosted workflow green on the final commit | External Git provider required |
| Backups | Automated backup plus documented restore drill | Hosting operation required |
| Monitoring | Availability, error-rate and latency alerts | Hosting operation required |
| Dependencies | Critical audit is clear; upstream Prisma CLI and Google Storage trees currently report high/moderate advisories and must be upgraded when compatible releases are available | Tracked; do not suppress audit output |
| Privacy/legal | Privacy policy, terms, retention and deletion workflow approved | Product-owner approval required |
| Crystal Reports | Final `.rpt` layout opened and verified on Windows | Windows/SAP tooling required |

Do not label this release generally available until every external gate above has owner, date and evidence. Until then use the version `1.0.0-rc.1`.
