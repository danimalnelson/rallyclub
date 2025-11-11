# Mission — Onboarding Regression Tests

## Trigger
- Any onboarding Playwright test fails.
- Reports of users stuck during onboarding or Stripe Connect flow.

## Objective
Keep the onboarding experience reliable by maintaining automated tests, mocks, and remediation loops.

## Test Coverage Targets
- New user login redirects to `/onboarding/details`.
- Business details submission succeeds and persists.
- Stripe Connect redirect + return updates status.
- Dashboard renders populated state after completion.
- Webhooks synchronize Stripe status.

## Prerequisites
- Seed data generator for new-user and completed-business scenarios.
- Stripe Connect API mocked for local runs.
- Playwright configured with environment variables.

## Operating Loop
1. Prepare fixtures:
   - Seed user without business.
   - Seed user with `Business.status = "ONBOARDING_COMPLETE"`.
2. Execute E2E suite: `pnpm playwright test --grep @onboarding` (adjust tag as needed).
3. On failure:
   - Locate failing step and responsible code path.
   - Apply targeted patch.
   - Re-run affected test file (`pnpm playwright test tests/onboarding.spec.ts`).
4. When local run passes, trigger CI or preview run and re-verify.
5. Log failures, fixes, and test output snippets in `/logs/onboarding-progress.md`.

## Verification
- Playwright onboarding suite passes locally and in CI.
- Manual smoke test on Vercel matches automated steps.
- No manual business creation required to reach dashboard.

## Exit Criteria
- Zero failing onboarding tests across environments.
- Latest log entry documents pass status with timestamp.

## Safety
- Never leak Stripe secrets in test fixtures.
- Prefer mocks/stubs for external API calls.
- Keep commits small and scoped to onboarding fixes.
