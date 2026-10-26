# Automated browser acceptance test

Run the production-like web/API smoke suite with:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite starts its own built API server on `127.0.0.1:4180` and Vite preview server on `127.0.0.1:5178`, then checks desktop and mobile Chromium. Existing development servers are never reused, demo mode is explicit, strict ports fail fast, and browser API checks use the same-origin preview proxy. This prevents a stale server on ports 4000/5173 from producing misleading results. It verifies every major page section, the public API contract, mobile navigation, demo student sign-in, Account & privacy, visible selects and safe tabs. It captures JavaScript console errors, uncaught page errors, failed first-party requests, HTTP 4xx/5xx responses and actions or API calls slower than one second.

Results are written to:

- `playwright-report/index.html` — visual HTML report, screenshots, traces and videos on failure
- `test-results/e2e-results.json` — machine-readable Playwright summary
- `edupath-e2e-audit.json` attachment inside each test result — exact controls, skipped state-changing actions, slow actions and technical errors

The crawler deliberately does not blindly mutate destructive or account-owned data. Shortlist, application, comment, vote, report, reminder and admin publishing actions remain covered by focused API/component tests or explicit acceptance scenarios. This prevents an automated audit from deleting or corrupting real user data.
