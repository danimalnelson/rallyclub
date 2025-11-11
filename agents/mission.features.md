# Mission — Feature Expansion Sprint

## Trigger
- Switch here when platform stability is confirmed and roadmap work is prioritized.
- Pause and return to incident missions if tests or deployments regress.

## Objective
Design, implement, and ship the Phase 2 feature backlog with full automated coverage and audit trails.

## Backlog (Work In Order)
1. **Business Profile Management**
   - Dashboard UI for name, logo, contact info, branding colors.
   - `/api/business/update` endpoint with Stripe metadata sync.
2. **Analytics Dashboard**
   - `/api/metrics` endpoint feeding Recharts components.
   - Metrics: MRR, active members, churn, revenue trend with caching.
3. **Email Notifications**
   - Resend templates for new members, failed payments, monthly summaries.
   - Store templates under `/packages/emails`.
4. **Public Business Page Enhancements**
   - Logo + banner support, brand colors, pricing toggle (monthly/yearly).
   - Live plan data fetched from Stripe.
5. **Member Portal Improvements**
   - Consumer invoice history and plan management.
   - “Manage Plan” button linking to Stripe Customer Portal.
6. **Developer Experience**
   - Auto-generate `/docs/api.md` from route handlers.
   - Publish typed SDK stubs in `/packages/sdk/`.

## Prerequisites
- `mission.build-fix.md` and `mission.onboarding.tests.md` are not active.
- Local environment configured with required secrets.
- Architecture patterns understood (`/docs/architecture.md`).

## Operating Loop
1. Select the next backlog item.
2. Draft `/docs/features/<feature>.md` capturing overview, implementation outline, and test plan.
3. Create branch `feature/<feature-slug>`.
4. Implement iteratively; keep patches reviewable.
5. Generate and update tests:
   - `tests/unit/<feature>.test.ts`
   - `tests/integration/<feature>.test.ts`
   - `tests/e2e/<feature>.spec.ts`
6. Run verification: `bash scripts/run-full-tests.sh`.
7. Address failures immediately; rerun until green.
8. Document progress in `/logs/feature-progress.md`.

## Verification
- Full test suite passing.
- Feature-specific manual smoke test complete.
- Documentation + changelog updated.

## Delivery Protocol
1. `git add .`
2. `git commit -m "feat(<feature>): <summary>"` (only when tests pass)
3. `git push origin feature/<feature-slug>`
4. Update `/logs/feature-progress.md` with date, scope, test status, and follow-ups.

## Exit Criteria
- All backlog items finished, merged, and deployed to Vercel.
- `/logs/final-feature-summary.md` created with outcomes and metrics.
- No failing tests or pending regressions.

## Safety
- Never commit secrets or `.env` values.
- Keep Prisma migrations atomic and reversible.
- If three consecutive builds fail, pause, summarize, and consult `mission.build-fix.md`.
- For hangs >5 minutes, terminate safely, log `[TIMEOUT DETECTED]`, and restart verification via `bash scripts/run-full-tests.sh`.
