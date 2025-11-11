# Diagnostic Playbook — Auth Flow

Use this checklist when authentication breaks unexpectedly and you need rapid triage before running the full mission.

## 1. Evidence Collection
- Run `vercel logs --since 15m` and capture auth-related stack traces.
- Start `pnpm dev`; reproduce the issue and copy console output.
- Record browser network errors for `/api/auth/*` requests.

## 2. Environment Validation
- Compare `.env.local`, Vercel project env, and `.env.example`.
- Confirm `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider keys, and `DATABASE_URL` are present and identical where required.
- Note discrepancies for follow-up.

## 3. Database Connectivity
- Execute `pnpm prisma db pull` to confirm credentials.
- Run `pnpm prisma migrate status` to verify migrations.
- Inspect Prisma logs for connection failures or schema drift.

## 4. Adapter & Configuration
- Review `/lib/auth.ts` or `app/api/auth/[...nextauth]/route.ts` for adapter wiring.
- Ensure callbacks, session strategy, and authorized redirects align with environment.
- Check that secret-dependent code branches handle missing vars gracefully.

## 5. Browser Flow
- Hit `/auth/signin` in a private window.
- Inspect cookies, redirects, and any blocked third-party storage.
- Capture screenshots or HAR files if anomalies appear.

## 6. Remediation Prep
- Summarize findings: root cause hypothesis, impacted components, suspected fix.
- Decide whether to escalate to `mission.auth.md`.
- Update `/logs/auth-progress.md` with collected evidence before making changes.

## Safety
- Do not paste secrets into logs or summaries.
- Pause and confirm before modifying production env vars.
- If diagnosis implicates multiple subsystems, escalate to a human or broader mission.
