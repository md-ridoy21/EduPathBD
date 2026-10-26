# Phase 3 - Admission Workflow

## Delivered

- Searchable institution catalog with institution-type and district filters
- Server-side page pagination and page metadata
- Searchable program catalog with academic-group filtering
- Persistent side-by-side comparison for up to three institutions
- Account-based institution shortlist
- Date-range picker for admission circular deadlines
- Program application tracker with controlled workflow statuses
- Four-item application document checklist with completion progress
- Admin program draft creation
- Admin sourced circular creation with date pickers
- Idempotent PostgreSQL seed script for institutions, programs, admission rules and circulars
- Lazy-loaded authentication and admin bundles for faster mobile startup

## Demo procedure

1. Run `npm run dev` with `DEMO_MODE=true`.
2. Open **Institutions** and test search, type, district and next-page controls.
3. Add two or three institutions to **Compare**.
4. Sign in with **Student demo**, shortlist an institution and track a program.
5. Open **Plan**, change the application status and complete checklist items.
6. Change the From/To dates in **Deadline calendar**.
7. Sign out, use **Admin demo**, and create a program and sourced circular.

## PostgreSQL data setup

After setting `DATABASE_URL` and completing the initial migration:

```bash
npm run db:migrate -- --name admission_workflow
npm run db:seed
```

The seed is safe to run repeatedly. Seed circulars are labelled as demonstration content and must be replaced or re-verified against current official notices before a public release.

## Verification

```bash
npm run typecheck
npm test
npm run verify:api
npm run build
npm run cap:sync --workspace @edupath/web
```

The Phase 3 API verifier checks 17 identity, authorization, catalog, pagination, shortlist, application, checklist and admin scenarios.
