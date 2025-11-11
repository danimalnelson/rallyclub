# Mission — Phase 2 Scaling

## Trigger
- Load when the platform is stable and ready to progress beyond MVP.
- Suspend if a blocking incident triggers a specialized mission (see `/agents/README.md`).

## Objective
Advance Vintigo from functional MVP to a production-ready, tenant-scaled platform with resilient payments and polished UX.

## Milestones
1. **Stability:** 100% test coverage across B2B, B2C, webhook, and embed routes.
2. **Payments polish:** Refunds, failed payment retries, and email notifications automated.
3. **Multi-tenancy hardening:** Strict business isolation, slug uniqueness, staff role enforcement.
4. **Admin UX polish:** Dashboard refreshed using shadcn/ui patterns.
5. **Consumer experience:** Lightweight email signup/login with session persistence.
6. **Documentation:** Deliver `/docs/api.md`, `/docs/stripe.md`, `/docs/deploy.md`.
7. **Optional:** Deploy to Vercel staging + Neon Postgres.

## Prerequisites
- Test suites green or actively being stabilized.
- Environment variables configured for local and Vercel environments.
- Architecture context from `/docs/architecture.md` reviewed.

## Operating Loop
1. Select the next incomplete milestone.
2. Break it into deliverables with acceptance criteria and tests.
3. Implement incrementally; keep diffs reviewable.
4. Run the full verification command: `bash scripts/run-full-tests.sh`.
5. Document outcomes and insights in relevant logs.
6. If tests fail, resolve before advancing.

## Verification
- Full test suite passing locally and in CI.
- Manual spot-check of the affected UX or workflow.
- Updated documentation and logs.

## Exit Criteria
- All milestones complete and verified.
- No failing tests or unresolved action items.
- Human architect provides new `mission.md` or confirms completion.

## Safety
- Fix regressions before adding scope.
- Keep commits small and reversible.
- When uncertain, present 2–3 options with trade-offs before proceeding.
