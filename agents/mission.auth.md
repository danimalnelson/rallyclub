# Mission Objective — Fix /auth/signin

## Goal
Diagnose and repair all issues preventing successful sign-in on the deployed app.

## Focus Areas
1. Environment variable mismatches (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider keys).
2. Prisma or adapter misconfiguration.
3. API route errors in `[...nextauth].ts` or `app/api/auth/[...nextauth]/route.ts`.
4. Redirect or session cookie failures in production.

## Loop
- Read Vercel logs (`vercel logs --since 15m`).
- Run local build/tests.
- Patch code or configuration.
- Rebuild and verify `/auth/signin`.
- Repeat until login succeeds.

## Rules
- Never expose secrets.
- Update `.env.example` with any new required vars.
- Summarize after every loop: root cause, patch, verification.

## Exit
Stop when:
- Login succeeds in both local and deployed environments.
- Tests pass for auth routes.
