# Mission — Authentication Recovery

## Trigger
- `/auth/signin` fails locally or on Vercel.
- Users cannot establish sessions or receive login emails.
- CI tests covering auth routes fail.

## Objective
Restore fully functional authentication across environments with correct env configuration, adapters, and redirects.

## Focus Areas
1. **Environment Consistency**
   - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider credentials present locally + Vercel.
2. **Adapter & Prisma Health**
   - Ensure Prisma adapter configured correctly; migrations up to date.
3. **Route Logic**
   - Inspect `app/api/auth/[...nextauth]/route.ts` (or equivalent) for handler issues.
4. **Session Flow**
   - Validate redirects, cookies, and callback URLs.

## Operating Loop
1. Collect telemetry:
   - `vercel logs --since 15m`
   - Local `pnpm dev` console output.
2. Align environment variables; update `.env.example` when new vars emerge.
3. Reproduce failure locally; write regression tests if missing.
4. Apply minimal patches (config, schema, code).
5. Run verification:
   - `bash scripts/run-full-tests.sh`
   - Targeted auth tests or Playwright specs.
6. Deploy fix or run preview; perform manual login to confirm.
7. Summarize root cause, fix, and verification results in `/logs/auth-progress.md`.
8. Repeat until authentication works end-to-end.

## Verification
- Automated auth tests pass.
- Manual sign-in on production/staging succeeds.
- Session cookies and redirects validated in browser.

## Exit Criteria
- Login succeeds locally and on Vercel without errors.
- Environment parity documented.
- No outstanding auth-related incidents.

## Safety
- Never expose secrets in logs or commits.
- Coordinate schema or adapter changes with database migrations.
- Roll back or pause if fixes risk locking out users.
