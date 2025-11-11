# Onboarding Progress Log
- Document onboarding-related fixes, test outcomes, and Stripe Connect incidents.
- For each entry provide timestamp, scenario, change summary, verification status, and outstanding work.

- 2025-11-11 14:35 PT — New business guard + status pipeline
  - Scenario: First-time business owners were hitting dashboard errors; onboarding stalled when Stripe Connect incomplete.
  - Changes:
    - Added `BusinessStatus` enum and database field (schema + Prisma client regenerate).
    - Updated `/app` dashboard to redirect unfinished businesses back into onboarding; block individual dashboards until status complete.
    - Enhanced Connect step to mark businesses pending and reused status when account already exists.
    - Extended Stripe webhook handler with `account.updated` processing to finalize onboarding and sync contact info.
    - Added polling + state awareness to `/onboarding/connect` and `/onboarding/success`.
  - Verification: `pnpm lint`, `pnpm build`.
  - Outstanding: Implement autosave + validation improvements for details step; expand Playwright onboarding coverage; run full test suite once migrations settle.

