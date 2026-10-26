# Automated browser acceptance test

Run the production-like web/API smoke suite with:

```bash
npx playwright install chromium
npm run test:e2e
```

The suite starts a built API server and a Vite preview server, then checks desktop and mobile Chromium. It verifies every major page section, the public API contract, mobile navigation, demo student sign-in, visible selects and safe tabs. It captures JavaScript console errors, uncaught page errors, failed first-party requests, HTTP 4xx/5xx responses and actions or API calls slower than one second.

Results are written to:

- `playwright-report/index.html` — visual HTML report, screenshots, traces and videos on failure
- `test-results/e2e-results.json` — machine-readable Playwright summary
- `edupath-e2e-audit.json` attachment inside each test result — exact controls, skipped state-changing actions, slow actions and technical errors

The crawler deliberately does not blindly mutate destructive or account-owned data. Shortlist, application, comment, vote, report, reminder and admin publishing actions remain covered by focused API/component tests or explicit acceptance scenarios. This prevents an automated audit from deleting or corrupting real user data.
