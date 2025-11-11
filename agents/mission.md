# Mission Objective — Phase 2

## Primary Goal
Advance the product from a functional MVP to a production-ready, tenant-scaled platform.

## Core Objectives
1. **Stability:** Ensure 100% of tests pass on all routes (B2B, B2C, webhook, embed).
2. **Payments polish:** Implement refunds, failed payment retries, and email notifications.
3. **Multi-tenancy hardening:** Add full isolation for business data, slug uniqueness, and staff role enforcement.
4. **Admin UX polish:** Improve dashboard design using shadcn/ui patterns.
5. **Consumer experience:** Add lightweight email signup/login for consumers with session persistence.
6. **Documentation:** Generate `/docs/api.md`, `/docs/stripe.md`, `/docs/deploy.md`.
7. **Optional:** Deploy to Vercel staging and Neon Postgres.

## Operating Principle
At all times:
- Fix failing tests before adding new features.
- Commit small, atomic changes.
- If uncertain, propose 2–3 next-step options.
- After each milestone, summarize progress and propose the next milestone.

## Termination Criteria
Stop advancing automatically when:
- The product is fully test-passing,
- The mission objectives above are achieved,
- A human requests a new mission file.
