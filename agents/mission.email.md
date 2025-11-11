# Mission — Email Delivery Recovery

## Trigger
- Authentication emails fail to send or deliver.
- Resend dashboard shows bounces/rejections.
- Support reports missing transactional messages.

## Objective
Restore reliable transactional email delivery through Resend across local, staging, and production environments.

## Prerequisites
- Resend account access with verified domains/senders.
- Environment variables available (`RESEND_API_KEY`, `NEXTAUTH_URL`, sender address).
- Application logging enabled for email send attempts.

## Operating Loop
1. **Environment Audit**
   - Confirm required env vars exist locally and on Vercel (no defaults).
   - Check sender domain verification status in Resend.
2. **Integration Review**
   - Inspect mailer code (`/lib/email.ts`, auth routes, or wherever emails send).
   - Ensure `process.env.RESEND_API_KEY` and verified `from` address are used.
   - Wrap send calls in try/catch with structured logging (exclude secrets).
3. **Resend Diagnostics**
   - Query recent events: `curl https://api.resend.com/emails` with auth header.
   - Capture bounce/rejection messages and map them to code paths.
4. **Local Verification**
   - Trigger a test send in development.
   - Validate console/log output indicates success and includes message ID.
5. **Deploy & Monitor**
   - Push fixes, run `bash scripts/run-full-tests.sh`, then deploy.
   - Perform login or transactional flow on Vercel.
   - Confirm delivery via inbox and Resend dashboard.
6. **Iterate & Log**
   - For each failure reason, document root cause, patch, and retest.
   - Append findings to `/logs/email-progress.md` (timestamp, issue, fix, verification).
   - Repeat until end-to-end delivery succeeds.

## Verification
- Automated tests covering email send paths pass.
- Manual login/transactional flows deliver emails within expected latency.
- Resend dashboard shows delivered status; errors documented and cleared.

## Exit Criteria
- Email delivery confirmed in local, staging (if applicable), and production.
- Logs updated with final summary and message IDs.
- No unresolved bounces or configuration warnings in Resend.

## Safety
- Never log or commit secrets (API keys, tokens).
- Avoid spamming live recipients; use test inboxes or whitelisted addresses.
- Rate limit retries to stay within Resend quotas.
