# Phase 7.3 — automatic browser quality audit

Phase 7.3 adds two free, local quality-assurance paths. Neither path needs an API key or paid service.

## In-browser live audit

Run `npm run dev` and open `http://localhost:5173`. Development builds display a floating **QA** button. The panel automatically checks:

- API health, catalog totals, institutions, programs and circulars;
- broken in-page navigation and duplicate element IDs;
- visible controls without an accessible name;
- undersized touch targets and horizontal viewport overflow;
- missing image alternatives, heading structure and local storage;
- JavaScript exceptions, unhandled promises, failed resources and application API failures captured during the current browser session.

Use **Copy report** or **Download JSON** to preserve exact browser, viewport, result and runtime-error evidence. Clear captured errors after applying a fix, reproduce the flow and run the checks again.

The button is hidden from normal production builds. Add `?qa=1` to a production URL only when release diagnostics are intentionally required.

Navigation checks allow lazy application sections to settle before reporting a missing target, and the health check uses the canonical `/api/health` endpoint.

## Full repository gate

Run:

```bash
npm run qa
```

This executes TypeScript checks, unit tests, API workflow verification, release evidence verification and the production build in order. A non-zero exit identifies the failed gate.

## Boundary

Automation detects technical and structural failures. Final human acceptance is still required for visual polish, content accuracy, wording quality and real-device usability.
