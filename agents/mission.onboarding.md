# Mission — Business Onboarding Flow

## Trigger
- A signed-in business user is missing a related `Business` or `BusinessUser` record.
- The dashboard renders an empty state or QA reports broken onboarding.
- Stripe Connect onboarding returns errors or incomplete accounts.

## Objective
Deliver a fail-safe onboarding journey that:
1. Collects business details.
2. Drives the user through Stripe-hosted Connect (Express) with minimal custom UI.
3. Persists status updates via webhooks.
4. Opens a populated dashboard immediately after completion.

## Prerequisites
- Environment variables configured locally and on Vercel:
  - `STRIPE_SECRET_KEY`, `STRIPE_CONNECT_CLIENT_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, and any branding assets (logo bucket, etc.).
- Stripe Connect Express enabled for the account; access to Stripe dashboard for test keys.
- Seed utilities ready for “new user” (no business) and “existing business” personas.
- Review supporting docs:
  - `/docs/features/business-profile-management.md`
  - `/docs/features/analytics-dashboard.md`
  - `/docs/architecture.md` (session routing + data model)

## Operating Loop
1. **Environment & Routing Guard**
   - Audit middleware/session utilities to detect users without `Business`/`BusinessUser`.
   - Redirect new users from dashboard to `/onboarding`.
   - Add regression tests for both guarded and unguarded paths.
2. **Business Details Step (`/onboarding/details`)**
   - Build form with autosave (React hook or mutation).
   - Persist via `/api/business/create` or `/api/business/profile`.
   - Validate input with Zod; ensure Prisma writes `status: "CREATED"`.
   - Handle optional logo upload (stub S3 if necessary).
   - Add unit + integration tests for the API route.
3. **Stripe Connect Step**
   - Implement `/api/stripe/connect/account-link` (or update existing route):
     - Create/retrieve Express account.
     - Persist `stripeAccountId` on the business.
     - Generate account link with `refresh_url`/`return_url` pointing to onboarding + dashboard.
   - Update UI to launch Stripe-hosted onboarding, surface loading/error states, and block progression until completion.
4. **Webhook & Status Updates**
   - Extend `/api/stripe/webhook/route.ts` to process `account.updated`, `account.external_account.updated`, etc.
   - Flip `Business.status` to `"ONBOARDING_COMPLETE"` when `details_submitted && charges_enabled`.
   - Sync Stripe metadata (support email, phone, brand colors) back to Prisma.
   - Add tests (unit/integration) for webhook handlers using Stripe fixtures/mocks.
5. **Confirmation & Dashboard Integration**
   - Build `/onboarding/success` summary page with “Go to Dashboard”.
   - Gate dashboard rendering until business status is `ONBOARDING_COMPLETE`.
   - Populate dashboard with starter metrics or placeholders to avoid empty states.
   - Update Playwright smoke tests to assert dashboard cards appear after onboarding.
6. **Testing & Logging**
   - Seed DB for both “new user” and “completed onboarding” flows.
   - Playwright spec: login → onboarding details → mocked Stripe redirect → dashboard.
   - Run `bash scripts/run-full-tests.sh` after each functional change.
   - For flaky Stripe flows, re-run `pnpm playwright test --grep @onboarding`.
   - Log every loop iteration (findings, commands, test status) in `/logs/onboarding-progress.md`.
7. **Deployment Verification**
   - Deploy to preview/staging, repeat flow with Stripe test mode.
   - Monitor Vercel logs and Stripe dashboard for webhook results.
   - Capture manual verification notes in the log.

## Verification
- Automated suites green: unit, integration, Playwright onboarding spec.
- Manual smoke test proves the end-to-end flow on local and Vercel.
- Stripe dashboard shows connected accounts with charges enabled.
- `/logs/onboarding-progress.md` entry documents latest run (timestamp, scope, verification).

## Exit Criteria
- Every first-login user is redirected into onboarding and exits with a connected Stripe account.
- Dashboard displays their business card/metrics immediately after completion.
- All onboarding tests are stable in CI and no unresolved Stripe errors remain.
- Documentation updated if APIs, env vars, or flows changed.

## Safety
- Never log Stripe secrets or personally identifiable business data.
- Catch and surface onboarding errors with actionable UI copy; avoid silent failures.
- For webhook retries, ensure idempotency using Stripe event IDs.
- Coordinate schema changes via Prisma migrations; run `bash scripts/run-full-tests.sh` post-migration.
